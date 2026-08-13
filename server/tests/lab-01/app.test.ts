import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

describe('TokTickIT API foundation', () => {
  it('starts the Express app and returns a root response', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'TokTickIT API',
      message: 'Project foundation is running'
    });
  });
});
