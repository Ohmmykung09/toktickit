import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Lab 2 lookup APIs', () => {
  it('returns active related systems ordered by name', async () => {
    const response = await request(app).get('/api/related-systems');

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

  it('returns active development requesters and excludes inactive ones', async () => {
    const response = await request(app).get('/api/development-requesters');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: expect.any(Number), name: 'Aom S.' },
      { id: expect.any(Number), name: 'Beam K.' },
      { id: expect.any(Number), name: 'Mew P.' },
      { id: expect.any(Number), name: 'Nok T.' }
    ]);
  });
});
