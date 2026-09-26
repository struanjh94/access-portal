import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { pool } from '../src/db/client.js';

afterAll(async () => {
  await pool.end();
});

describe('GET /health', () => {
  it('returns 200 when the database is reachable', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'OK' });
  });
});
