import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { Role, UserSummary } from '../../shared/contract.js';
import type { ErrorResponse } from '../../shared/errors.js';
import { app } from '../src/app.js';
import { pool } from '../src/db/client.js';

const ADA = '11111111-1111-4111-8111-111111111111';
const GRACE = '22222222-2222-4222-8222-222222222222';
const ALAN = '33333333-3333-4333-8333-333333333333';

const MARGARET = '55555555-5555-4555-8555-555555555555';
const BARBARA = '66666666-6666-4666-8666-666666666666';

const TEST_DOMAIN = '@roles-test.example.com';

/*
 * Throwaway users so the tests never change a seeded user's roles, except in the
 * last-admin case, which cannot be reached without stripping the seeded admins.
 * Display names start with Zz because another test asserts which user sorts first.
 */
async function createUser(roles: string[] = []): Promise<string> {
  const email = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${TEST_DOMAIN}`;

  const { rows } = await pool.query<{ id: string }>(
    `insert into users (email, display_name) values ($1, $2) returning id`,
    [email, `Zz ${email}`],
  );

  const id = rows[0]?.id;
  if (!id) throw new Error('Could not create a test user');

  if (roles.length > 0) {
    await pool.query(
      `insert into user_roles (user_id, role_key, granted_by)
       select $1, role_key, $3 from unnest($2::text[]) as role_key`,
      [id, roles, ADA],
    );
  }

  return id;
}

async function rolesHeldBy(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ role_key: string }>(
    'select role_key from user_roles where user_id = $1 order by role_key',
    [userId],
  );

  return rows.map((row) => row.role_key);
}

type AuditRow = { action: string; role_key: string | null; details: unknown };

async function auditRowsFor(userId: string): Promise<AuditRow[]> {
  const { rows } = await pool.query<AuditRow>(
    'select action, role_key, details from audit_logs where target_user_id = $1 order by id',
    [userId],
  );

  return rows;
}

function putRoles(userId: string, roles: string[], actorId = ADA) {
  return request(app).put(`/users/${userId}/roles`).set('X-Actor-Id', actorId).send({ roles });
}

afterAll(async () => {
  /* Put the seeded admins back, whatever the last-admin test managed to change. */
  await pool.query('delete from user_roles where user_id = any($1)', [[ADA, GRACE]]);
  await pool.query(
    `insert into user_roles (user_id, role_key, granted_by)
     select id, 'admin', $1 from users where id = any($2)`,
    [ADA, [ADA, GRACE]],
  );

  await pool.query('delete from users where email like $1', [`%${TEST_DOMAIN}`]);
  await pool.end();
});

describe('PUT /users/:id/roles', () => {
  it('grants roles to a user who holds none', async () => {
    const userId = await createUser();

    const res = await putRoles(userId, ['viewer', 'support', 'viewer']);

    expect(res.status).toBe(200);
    expect((res.body as UserSummary).roles).toEqual(['support', 'viewer']);
    expect(await rolesHeldBy(userId)).toEqual(['support', 'viewer']);

    expect(await auditRowsFor(userId)).toEqual([
      {
        action: 'role.granted',
        role_key: 'support',
        details: { before: [], after: ['support', 'viewer'] },
      },
      {
        action: 'role.granted',
        role_key: 'viewer',
        details: { before: [], after: ['support', 'viewer'] },
      },
    ]);
  });

  it('writes nothing when the submitted set matches what is held', async () => {
    const userId = await createUser(['viewer']);

    const res = await putRoles(userId, ['viewer']);

    expect(res.status).toBe(200);
    expect((res.body as UserSummary).roles).toEqual(['viewer']);
    expect(await auditRowsFor(userId)).toEqual([]);
  });

  it('revokes only the roles the request leaves out', async () => {
    const userId = await createUser(['support', 'viewer']);

    const res = await putRoles(userId, ['viewer']);

    expect(res.status).toBe(200);
    expect(await rolesHeldBy(userId)).toEqual(['viewer']);

    expect(await auditRowsFor(userId)).toEqual([
      {
        action: 'role.revoked',
        role_key: 'support',
        details: { before: ['support', 'viewer'], after: ['viewer'] },
      },
    ]);
  });

  it('revokes every role for an empty array', async () => {
    const userId = await createUser(['support', 'viewer']);

    const res = await putRoles(userId, []);

    expect(res.status).toBe(200);
    expect((res.body as UserSummary).roles).toEqual([]);
    expect(await rolesHeldBy(userId)).toEqual([]);
  });

  it('grants and revokes in one request', async () => {
    const userId = await createUser(['support']);

    const res = await putRoles(userId, ['viewer']);

    expect(res.status).toBe(200);
    expect(await rolesHeldBy(userId)).toEqual(['viewer']);
    expect((await auditRowsFor(userId)).map((row) => [row.action, row.role_key])).toEqual([
      ['role.revoked', 'support'],
      ['role.granted', 'viewer'],
    ]);
  });

  it('rejects a role that does not exist, naming it', async () => {
    const userId = await createUser();

    const res = await putRoles(userId, ['viewer', 'wizard']);

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('unknown_role');
    expect((res.body as ErrorResponse).error.message).toMatch(/wizard/);
    expect(await rolesHeldBy(userId)).toEqual([]);
  });

  it('rejects a user id that is not a UUID', async () => {
    const res = await putRoles('not-a-uuid', ['viewer']);

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('invalid_user_id');
  });

  it('returns 404 for a well-formed id matching no user', async () => {
    const res = await putRoles('99999999-9999-4999-8999-999999999999', ['viewer']);

    expect(res.status).toBe(404);
    expect((res.body as ErrorResponse).error.code).toBe('user_not_found');
  });

  it('rejects a body whose roles is not an array', async () => {
    const userId = await createUser();

    const res = await request(app)
      .put(`/users/${userId}/roles`)
      .set('X-Actor-Id', ADA)
      .send({ roles: 'admin' });

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('invalid_body');
  });

  it('rejects an unrecognised field', async () => {
    const userId = await createUser();

    const res = await request(app)
      .put(`/users/${userId}/roles`)
      .set('X-Actor-Id', ADA)
      .send({ roles: ['viewer'], grantedBy: ADA });

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('invalid_body');
  });

  it('rejects an actor who holds neither role key', async () => {
    const userId = await createUser();

    const res = await putRoles(userId, ['viewer'], ALAN);

    expect(res.status).toBe(403);
    expect((res.body as ErrorResponse).error.message).toMatch(/roles:grant, roles:revoke/);
  });

  /*
   * The invariant is that someone still holds both roles:grant and roles:revoke. It is
   * global, so reaching the last one means taking the role off both seeded admins: the
   * first succeeds, the second is refused and rolled back.
   */
  it('refuses to leave nobody able to manage access', async () => {
    const demoted = await putRoles(GRACE, ['viewer']);
    expect(demoted.status).toBe(200);

    const res = await putRoles(ADA, ['viewer']);

    expect(res.status).toBe(409);
    expect((res.body as ErrorResponse).error.code).toBe('last_admin');
    expect(await rolesHeldBy(ADA)).toEqual(['admin']);
  });
});

describe('GET /roles', () => {
  it('returns every role with its name and description, ordered by key', async () => {
    const res = await request(app).get('/roles').set('X-Actor-Id', MARGARET);

    expect(res.status).toBe(200);

    const roles = res.body as Role[];
    expect(roles.map((role) => role.key)).toEqual(['admin', 'support', 'viewer']);
    expect(roles[0]).toEqual({
      key: 'admin',
      name: 'Administrator',
      description: 'Full access: manage users and their roles, and read the audit log',
    });
  });

  /*
   * The catalogue is what lets the UI offer a role again after the last person holding
   * it loses it, so it cannot be derived from what users currently hold.
   */
  it('includes a role nobody holds', async () => {
    const orphan = `orphan-${Date.now()}`;

    await pool.query(
      `insert into roles (key, name, description) values ($1, 'Orphan', 'Held by nobody')`,
      [orphan],
    );

    try {
      const res = await request(app).get('/roles').set('X-Actor-Id', MARGARET);

      expect((res.body as Role[]).map((role) => role.key)).toContain(orphan);
    } finally {
      await pool.query('delete from roles where key = $1', [orphan]);
    }
  });

  it('rejects an actor without roles:read', async () => {
    const res = await request(app).get('/roles').set('X-Actor-Id', BARBARA);

    expect(res.status).toBe(403);
    expect((res.body as ErrorResponse).error.message).toMatch(/roles:read/);
  });

  it('rejects a request with no actor', async () => {
    const res = await request(app).get('/roles');

    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error.code).toBe('missing_actor');
  });
});
