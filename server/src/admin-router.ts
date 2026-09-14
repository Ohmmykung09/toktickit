import { Prisma, UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireRole } from './auth-router.js';
import { hashPassword, isValidEmail, normalizeEmail, passwordValidationError } from './auth-policy.js';
import { prisma } from './db.js';

export const adminRouter = Router();
const administratorOnly = requireRole(UserRole.ADMINISTRATOR);
const publicUserSelect = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true } satisfies Prisma.UserSelect;
const maximumSerializableAttempts = 3;

type AdminMutationTestHooks = {
  beforeTransaction?: (operation: 'create' | 'update' | 'reset') => Promise<void>;
};

let adminMutationTestHooks: AdminMutationTestHooks = {};

export function setAdminMutationTestHooksForTesting(hooks: AdminMutationTestHooks) {
  if (process.env.NODE_ENV !== 'test') throw new Error('Administrator test hooks are available only in tests.');
  adminMutationTestHooks = hooks;
}

class AdminMutationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string>
  ) {
    super(message);
  }
}

type LockedUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

async function lockUsers(transaction: Prisma.TransactionClient, userIds: number[]) {
  const uniqueIds = [...new Set(userIds)].sort((left, right) => left - right);
  return transaction.$queryRaw<LockedUser[]>(Prisma.sql`
    SELECT "id", "name", "email", "role", "isActive"
    FROM "User"
    WHERE "id" IN (${Prisma.join(uniqueIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
}

function requireCurrentAdministrator(users: LockedUser[], actorId: number) {
  const actor = users.find(({ id }) => id === actorId);
  if (!actor || !actor.isActive || actor.role !== UserRole.ADMINISTRATOR) {
    throw new AdminMutationError(403, 'FORBIDDEN', 'You do not have permission to perform this action.');
  }
}

async function runSerializable<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= maximumSerializableAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      });
    } catch (caught) {
      const retryable = caught instanceof Prisma.PrismaClientKnownRequestError && (
        caught.code === 'P2034' ||
        (caught.code === 'P2010' && caught.meta?.code === '40001')
      );
      if (!retryable || attempt === maximumSerializableAttempts) throw caught;
    }
  }
  throw new Error('Serializable transaction retry limit reached.');
}

function error(response: Parameters<Parameters<typeof adminRouter.get>[1]>[1], status: number, code: string, message: string, fieldErrors?: Record<string, string>) {
  response.status(status).json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } });
}

function single(value: unknown) {
  if (value === undefined) return undefined;
  return typeof value === 'string' ? value : null;
}

function validRole(value: unknown): value is UserRole {
  return typeof value === 'string' && Object.values(UserRole).includes(value as UserRole);
}

adminRouter.get('/admin/users', administratorOnly, async (request, response, next) => {
  try {
    const searchValue = single(request.query.search);
    const roleValue = single(request.query.role);
    const search = typeof searchValue === 'string' ? searchValue.trim() : searchValue;
    if (search === null || (search !== undefined && (!search || search.length > 100)) || roleValue === null || (roleValue !== undefined && !validRole(roleValue))) {
      error(response, 400, 'INVALID_QUERY', 'User list parameters are invalid.');
      return;
    }
    const users = await prisma.user.findMany({
      where: {
        ...(roleValue ? { role: roleValue } : {}),
        ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: normalizeEmail(search), mode: 'insensitive' } }] } : {})
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: publicUserSelect
    });
    response.status(200).json(users);
  } catch (caught) { next(caught); }
});

function createInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { fieldErrors: { form: 'Enter valid user details.' } };
  const data = body as Record<string, unknown>;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? normalizeEmail(data.email) : '';
  const initialPassword = typeof data.initialPassword === 'string' ? data.initialPassword : '';
  const fieldErrors: Record<string, string> = {};
  if (name.length < 2 || name.length > 100) fieldErrors.name = 'Name must contain 2 to 100 characters.';
  if (!isValidEmail(email)) fieldErrors.email = 'Enter a valid email address.';
  if (!validRole(data.role)) fieldErrors.role = 'Select one valid role.';
  if (typeof data.isActive !== 'boolean') fieldErrors.isActive = 'Select an activation state.';
  const passwordError = passwordValidationError(initialPassword, email);
  if (passwordError) fieldErrors.initialPassword = passwordError;
  return Object.keys(fieldErrors).length ? { fieldErrors } : { value: { name, email, role: data.role as UserRole, isActive: data.isActive as boolean, initialPassword } };
}

adminRouter.post('/admin/users', administratorOnly, async (request, response, next) => {
  try {
    const parsed = createInput(request.body);
    if (!parsed.value) {
      error(response, 400, 'VALIDATION_ERROR', 'User details are invalid.', parsed.fieldErrors);
      return;
    }
    const value = parsed.value;
    const passwordHash = await hashPassword(value.initialPassword, value.email);
    await adminMutationTestHooks.beforeTransaction?.('create');
    const user = await runSerializable(async (transaction) => {
      const users = await lockUsers(transaction, [request.auth!.user.id]);
      requireCurrentAdministrator(users, request.auth!.user.id);
      return transaction.user.create({
        data: { name: value.name, email: value.email, role: value.role, isActive: value.isActive, passwordHash, passwordProvisionedAt: new Date(), mustChangePassword: true },
        select: publicUserSelect
      });
    });
    response.status(201).json(user);
  } catch (caught) {
    if (caught instanceof AdminMutationError) { error(response, caught.status, caught.code, caught.message, caught.fieldErrors); return; }
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') {
      error(response, 409, 'EMAIL_ALREADY_EXISTS', 'A user with this email address already exists.');
      return;
    }
    next(caught);
  }
});

function updateInput(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const input = body as Record<string, unknown>;
  const allowed = ['name', 'email', 'role', 'isActive'];
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowed.includes(key))) return null;
  const data: Prisma.UserUpdateInput = {};
  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 100) return null;
    data.name = input.name.trim();
  }
  if ('email' in input) {
    if (typeof input.email !== 'string' || !isValidEmail(input.email)) return null;
    data.email = normalizeEmail(input.email);
  }
  if ('role' in input) {
    if (!validRole(input.role)) return null;
    data.role = input.role;
  }
  if ('isActive' in input) {
    if (typeof input.isActive !== 'boolean') return null;
    data.isActive = input.isActive;
  }
  return data;
}

adminRouter.patch('/admin/users/:userId', administratorOnly, async (request, response, next) => {
  try {
    const userId = Number(request.params.userId);
    const data = updateInput(request.body);
    if (!Number.isSafeInteger(userId) || userId <= 0 || !data) {
      error(response, 400, 'VALIDATION_ERROR', 'User update is invalid.');
      return;
    }
    await adminMutationTestHooks.beforeTransaction?.('update');
    const user = await runSerializable(async (transaction) => {
      const users = await lockUsers(transaction, [request.auth!.user.id, userId]);
      requireCurrentAdministrator(users, request.auth!.user.id);
      const target = users.find(({ id }) => id === userId);
      if (!target) throw new AdminMutationError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
      if (userId === request.auth!.user.id && data.isActive === false) {
        throw new AdminMutationError(409, 'ADMIN_SAFETY_RULE', 'You cannot deactivate your own account.');
      }

      const nextRole = typeof data.role === 'string' ? data.role : target.role;
      const nextIsActive = typeof data.isActive === 'boolean' ? data.isActive : target.isActive;
      const removesActiveAdmin = target.role === UserRole.ADMINISTRATOR && target.isActive && (!nextIsActive || nextRole !== UserRole.ADMINISTRATOR);
      if (removesActiveAdmin) {
        const activeAdministrators = await transaction.user.count({
          where: { role: UserRole.ADMINISTRATOR, isActive: true }
        });
        if (activeAdministrators <= 1) {
          throw new AdminMutationError(409, 'ADMIN_SAFETY_RULE', 'At least one active Administrator must remain.');
        }
      }

      const roleChanged = nextRole !== target.role;
      const deactivated = target.isActive && !nextIsActive;
      const profileChanged =
        (typeof data.name === 'string' && data.name !== target.name) ||
        (typeof data.email === 'string' && data.email !== target.email);
      const losesStaffEligibility =
        (target.role === UserRole.IT_STAFF || target.role === UserRole.ADMINISTRATOR) &&
        (!nextIsActive || nextRole === UserRole.REQUESTER);
      const invalidatesSessions = deactivated || roleChanged || profileChanged;
      const changedAt = new Date();

      if (losesStaffEligibility) {
        await transaction.ticket.updateMany({
          where: { ownerId: userId },
          data: { ownerId: null, updatedAt: changedAt }
        });
      }

      const updated = await transaction.user.update({
        where: { id: userId },
        data: { ...data, ...(invalidatesSessions ? { sessionVersion: { increment: 1 } } : {}) },
        select: publicUserSelect
      });
      if (invalidatesSessions) {
        await transaction.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: changedAt }
        });
      }
      return updated;
    });
    response.status(200).json(user);
  } catch (caught) {
    if (caught instanceof AdminMutationError) { error(response, caught.status, caught.code, caught.message, caught.fieldErrors); return; }
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') { error(response, 409, 'EMAIL_ALREADY_EXISTS', 'A user with this email address already exists.'); return; }
    next(caught);
  }
});

adminRouter.post('/admin/users/:userId/initial-password', administratorOnly, async (request, response, next) => {
  try {
    const userId = Number(request.params.userId);
    const password = request.body && typeof request.body.initialPassword === 'string' ? request.body.initialPassword : '';
    if (!Number.isSafeInteger(userId) || userId <= 0) { error(response, 404, 'RESOURCE_NOT_FOUND', 'User not found.'); return; }
    const validation = passwordValidationError(password);
    if (validation) { error(response, 400, 'VALIDATION_ERROR', validation, { initialPassword: validation }); return; }
    const passwordHash = await hashPassword(password);
    await adminMutationTestHooks.beforeTransaction?.('reset');
    await runSerializable(async (transaction) => {
      const users = await lockUsers(transaction, [request.auth!.user.id, userId]);
      requireCurrentAdministrator(users, request.auth!.user.id);
      const target = users.find(({ id }) => id === userId);
      if (!target) throw new AdminMutationError(404, 'RESOURCE_NOT_FOUND', 'User not found.');
      const targetValidation = passwordValidationError(password, target.email);
      if (targetValidation) {
        throw new AdminMutationError(400, 'VALIDATION_ERROR', targetValidation, { initialPassword: targetValidation });
      }
      const changedAt = new Date();
      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash, passwordProvisionedAt: changedAt, mustChangePassword: true, sessionVersion: { increment: 1 }, failedLoginAttempts: 0, failedLoginWindowStartedAt: null, lockedUntil: null }
      });
      await transaction.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: changedAt } });
    });
    response.status(204).end();
  } catch (caught) {
    if (caught instanceof AdminMutationError) { error(response, caught.status, caught.code, caught.message, caught.fieldErrors); return; }
    next(caught);
  }
});
