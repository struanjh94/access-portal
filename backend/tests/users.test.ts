import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { UserSummary } from '../../shared/contract.js';
import type { ErrorResponse } from '../../shared/errors.js';
import { app } from '../src/app.js';
import { pool } from '../src/db/client.js';

const ADA = '11111111-1111-4111-8111-111111111111';
const ALAN = '33333333-3333-4333-8333-333333333333';
const BARBARA = '66666666-6666-4666-8666-666666666666';

const TEST_DOMAIN = '@users-test.example.com';

/*
 * A fresh address per run, because a run that fails before afterAll leaves its user
 * behind and the email index is unique.
 */
function uniqueEmail(): string {
  return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${TEST_DOMAIN}`;
}

afterAll(async () => {
  /* Their audit entries survive: audit_logs records ids as values, not references. */
  await pool.query('delete from users where email like $1', [`%${TEST_DOMAIN}`]);
  await pool.end();
});

describe('GET /users', () => {
  it('returns every user with the roles they hold', async () => {
    const res = await request(app).get('/users').set('X-Actor-Id', ALAN);

    expect(res.status).toBe(200);

    const users = res.body as UserSummary[];
    expect(users[0]?.displayName).toBe('Ada Lovelace');
    expect(users.find((user) => user.email === 'katherine.j@example.com')?.roles).toEqual([
      'support',
      'viewer',
    ]);
    expect(users.find((user) => user.email === 'barbara.liskov@example.com')?.roles).toEqual([]);
    expect(new Date(users[0]?.createdAt ?? '').getTime()).not.toBeNaN();
  });

  it('rejects an actor holding no roles', async () => {
    const res = await request(app).get('/users').set('X-Actor-Id', BARBARA);

    expect(res.status).toBe(403);
    expect((res.body as ErrorResponse).error.code).toBe('forbidden');
  });
});

describe('POST /users', () => {
  it('creates a user with no roles and audits the creation', async () => {
    const email = uniqueEmail();

    const res = await request(app)
      .post('/users')
      .set('X-Actor-Id', ADA)
      .send({ email, displayName: 'Radia Perlman' });

    expect(res.status).toBe(201);

    const created = res.body as UserSummary;
    expect(created).toMatchObject({ email, displayName: 'Radia Perlman', roles: [] });

    const { rows } = await pool.query(
      `select action, actor_email, target_user_email, role_key, details
         from audit_logs
        where target_user_id = $1`,
      [created.id],
    );

    expect(rows).toEqual([
      {
        action: 'user.created',
        actor_email: 'ada.lovelace@example.com',
        target_user_email: email,
        role_key: null,
        details: {},
      },
    ]);

    const list = await request(app).get('/users').set('X-Actor-Id', ADA);
    expect((list.body as UserSummary[]).map((user) => user.id)).toContain(created.id);
  });

  it('trims and lowercases the email before storing it', async () => {
    const email = uniqueEmail();

    const res = await request(app)
      .post('/users')
      .set('X-Actor-Id', ADA)
      .send({ email: `  ${email.toUpperCase()} `, displayName: '  Sophie Wilson  ' });

    expect(res.status).toBe(201);
    expect(res.body as UserSummary).toMatchObject({ email, displayName: 'Sophie Wilson' });
  });

  it('rejects an email already in use, ignoring case', async () => {
    const res = await request(app)
      .post('/users')
      .set('X-Actor-Id', ADA)
      .send({ email: 'ADA.LOVELACE@example.com', displayName: 'Impostor' });

    expect(res.status).toBe(409);
    expect((res.body as ErrorResponse).error.code).toBe('email_taken');
  });

  it('rejects a body that fails the schema', async () => {
    const res = await request(app)
      .post('/users')
      .set('X-Actor-Id', ADA)
      .send({ email: 'not-an-email', displayName: '' });

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('invalid_body');
    expect((res.body as ErrorResponse).error.message).toMatch(/email/);
  });

  it('rejects an unrecognised field', async () => {
    const res = await request(app)
      .post('/users')
      .set('X-Actor-Id', ADA)
      .send({ email: uniqueEmail(), displayName: 'Karen Sparck Jones', roles: ['admin'] });

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('invalid_body');
  });

  it('rejects an actor who may read users but not create them', async () => {
    const res = await request(app)
      .post('/users')
      .set('X-Actor-Id', ALAN)
      .send({ email: uniqueEmail(), displayName: 'Shafi Goldwasser' });

    expect(res.status).toBe(403);
  });
});
