import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';
import { authenticatedRequest } from '../authenticated-request.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 lookup APIs', () => {
  it('returns active related systems ordered by name', async () => {
    const api = await authenticatedRequest(app);
    const response = await api.get('/api/related-systems');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: expect.any(Number), name: 'Campus Wi-Fi' },
      { id: expect.any(Number), name: 'Corporate Laptop' },
      { id: expect.any(Number), name: 'Email' },
      { id: expect.any(Number), name: 'Grade Submission App' },
      { id: expect.any(Number), name: 'LEB2 App' },
      { id: expect.any(Number), name: 'Printer' },
      { id: expect.any(Number), name: 'VPN' }
    ]);
  });
});
