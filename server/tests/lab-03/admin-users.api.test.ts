import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { hashPassword } from '../../src/auth-policy.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

afterEach(async () => { await prisma.user.deleteMany({ where: { email: { endsWith: '@admin-test.example' } } }); });
afterAll(async () => { await prisma.$disconnect(); });

async function administratorApi() {
  const administrator = await prisma.user.findFirstOrThrow({ where: { role: 'ADMINISTRATOR', isActive: true } });
  return authenticatedRequest(app, administrator.id);
}

describe('Lab 3 Administrator user management', () => {
  it('lists allowlisted fields and creates a canonical user with one role', async () => {
    const api = await administratorApi();
    const created = await api.post('/api/admin/users').send({ name: 'New Support User', email: '  NEW.USER@ADMIN-TEST.EXAMPLE ', role: 'IT_STAFF', isActive: true, initialPassword: 'InitialPass123!' });
    expect(created.status).toBe(201);
    expect(created.body).toEqual(expect.objectContaining({ email: 'new.user@admin-test.example', role: 'IT_STAFF', isActive: true, mustChangePassword: true }));
    expect(created.body).not.toHaveProperty('passwordHash');
    expect(created.body).not.toHaveProperty('sessionVersion');
    const listed = await api.get('/api/admin/users?search=new.user&role=IT_STAFF');
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.id);
  });

  it('rejects duplicate canonical email, invalid roles, and Requester access', async () => {
    const api = await administratorApi();
    const requester = await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } });
    const requesterApi = await authenticatedRequest(app, requester.id);
    await api.post('/api/admin/users').send({ name: 'First User', email: 'duplicate@admin-test.example', role: 'REQUESTER', isActive: true, initialPassword: 'InitialPass123!' });
    const duplicate = await api.post('/api/admin/users').send({ name: 'Second User', email: 'DUPLICATE@ADMIN-TEST.EXAMPLE', role: 'REQUESTER', isActive: true, initialPassword: 'InitialPass123!' });
    const invalidRole = await api.post('/api/admin/users').send({ name: 'Invalid User', email: 'invalid@admin-test.example', role: 'OWNER', isActive: true, initialPassword: 'InitialPass123!' });
    const forbidden = await requesterApi.get('/api/admin/users');
    expect(duplicate.status).toBe(409); expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(invalidRole.status).toBe(400); expect(invalidRole.body.error.fieldErrors.role).toBeTruthy();
    expect(forbidden.status).toBe(403);
  });

  it('enforces administrator safety rules', async () => {
    const api = await administratorApi();
    const administrator = api.user;
    const selfDeactivate = await api.patch(`/api/admin/users/${administrator.id}`).send({ isActive: false });
    expect(selfDeactivate.status).toBe(409);
    expect(selfDeactivate.body.error.code).toBe('ADMIN_SAFETY_RULE');

    const otherAdministrators = await prisma.user.count({ where: { role: 'ADMINISTRATOR', isActive: true, id: { not: administrator.id } } });
    if (otherAdministrators === 0) {
      const demoteLast = await api.patch(`/api/admin/users/${administrator.id}`).send({ role: 'IT_STAFF' });
      expect(demoteLast.status).toBe(409);
      expect(demoteLast.body.error.code).toBe('ADMIN_SAFETY_RULE');
    }
  });

  it('revokes existing sessions when an initial password is replaced', async () => {
    const api = await administratorApi();
    const passwordHash = await hashPassword('OldInitial123!');
    const target = await prisma.user.create({ data: { name: 'Password Target', email: 'password.target@admin-test.example', role: 'REQUESTER', isActive: true, passwordHash, passwordProvisionedAt: new Date(), mustChangePassword: false } });
    const targetApi = await authenticatedRequest(app, target.id);
    expect((await targetApi.get('/api/categories')).status).toBe(200);
    const reset = await api.post(`/api/admin/users/${target.id}/initial-password`).send({ initialPassword: 'NewInitial456!' });
    expect(reset.status).toBe(204);
    expect((await targetApi.get('/api/categories')).status).toBe(401);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).mustChangePassword).toBe(true);
  });
});
