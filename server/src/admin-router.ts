import { Prisma, UserRole } from '@prisma/client';
import { Router } from 'express';
import { requireRole } from './auth-router.js';
import { hashPassword, isValidEmail, normalizeEmail, passwordValidationError } from './auth-policy.js';
import { prisma } from './db.js';

export const adminRouter = Router();
const administratorOnly = requireRole(UserRole.ADMINISTRATOR);
const publicUserSelect = { id: true, name: true, email: true, role: true, isActive: true, mustChangePassword: true, createdAt: true, updatedAt: true } satisfies Prisma.UserSelect;

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
    const user = await prisma.user.create({ data: { name: value.name, email: value.email, role: value.role, isActive: value.isActive, passwordHash, passwordProvisionedAt: new Date(), mustChangePassword: true }, select: publicUserSelect });
    response.status(201).json(user);
  } catch (caught) {
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
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) { error(response, 404, 'RESOURCE_NOT_FOUND', 'User not found.'); return; }
    if (userId === request.auth!.user.id && data.isActive === false) {
      error(response, 409, 'ADMIN_SAFETY_RULE', 'You cannot deactivate your own account.'); return;
    }
    const removesActiveAdmin = target.role === UserRole.ADMINISTRATOR && target.isActive && (data.isActive === false || (data.role !== undefined && data.role !== UserRole.ADMINISTRATOR));
    if (removesActiveAdmin && await prisma.user.count({ where: { role: UserRole.ADMINISTRATOR, isActive: true } }) <= 1) {
      error(response, 409, 'ADMIN_SAFETY_RULE', 'At least one active Administrator must remain.'); return;
    }
    const deactivate = target.isActive && data.isActive === false;
    const user = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({ where: { id: userId }, data: { ...data, ...(deactivate ? { sessionVersion: { increment: 1 } } : {}) }, select: publicUserSelect });
      if (deactivate) await transaction.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
    response.status(200).json(user);
  } catch (caught) {
    if (caught instanceof Prisma.PrismaClientKnownRequestError && caught.code === 'P2002') { error(response, 409, 'EMAIL_ALREADY_EXISTS', 'A user with this email address already exists.'); return; }
    next(caught);
  }
});

adminRouter.post('/admin/users/:userId/initial-password', administratorOnly, async (request, response, next) => {
  try {
    const userId = Number(request.params.userId);
    const password = request.body && typeof request.body.initialPassword === 'string' ? request.body.initialPassword : '';
    const target = Number.isSafeInteger(userId) && userId > 0 ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!target) { error(response, 404, 'RESOURCE_NOT_FOUND', 'User not found.'); return; }
    const validation = passwordValidationError(password, target.email);
    if (validation) { error(response, 400, 'VALIDATION_ERROR', validation, { initialPassword: validation }); return; }
    const passwordHash = await hashPassword(password, target.email);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash, passwordProvisionedAt: new Date(), mustChangePassword: true, sessionVersion: { increment: 1 }, failedLoginAttempts: 0, failedLoginWindowStartedAt: null, lockedUntil: null } }),
      prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    response.status(204).end();
  } catch (caught) { next(caught); }
});
