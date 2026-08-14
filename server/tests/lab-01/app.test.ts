import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('TokTickIT API foundation', () => {
  it('starts the Express app and returns a root response', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'TokTickIT API',
      message: 'Project foundation is running'
    });
  });

  it('returns the health check status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'TokTickIT API'
    });
  });

  it('returns the seeded request categories', async () => {
    const response = await request(app).get('/api/categories');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: expect.any(Number), name: 'Account and Access' },
      { id: expect.any(Number), name: 'Hardware' },
      { id: expect.any(Number), name: 'Software' },
      { id: expect.any(Number), name: 'Network' }
    ]);
  });
});
