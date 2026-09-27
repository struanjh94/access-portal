import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { AuditLogEntry } from '../../shared/contract.js';
import type { ErrorResponse } from '../../shared/errors.js';
import { app } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { HISTORY_LIMIT } from '../src/services/audit-logs.js';

const ADA = '11111111-1111-4111-8111-111111111111';
const ALAN = '33333333-3333-4333-8333-333333333333';
const MARGARET = '55555555-5555-4555-8555-555555555555';

afterAll(async () => {
  await pool.end();
});

describe('audit_logs', () => {
  // A row-level trigger does not fire on a statement that matches no rows, so
  // first verify the table has some rows
  it('has seeded history for the following tests to act on', async () => {
    const { rows } = await pool.query<{ count: number }>(
      'select count(*)::int as count from audit_logs',
    );

    expect(rows[0]?.count ?? 0).toBeGreaterThan(0);
  });

  it('rejects an update', async () => {
    await expect(pool.query("update audit_logs set action = 'role.revoked'")).rejects.toThrow(
      /append-only/,
    );
  });

  it('rejects a delete', async () => {
    await expect(pool.query('delete from audit_logs')).rejects.toThrow(/append-only/);
  });

  /*
   * A row trigger does not fire on truncate, so the table needs a statement-level
   * trigger of its own. Without it the whole history can be dropped in one command.
   */
  it('rejects a truncate', async () => {
    await expect(pool.query('truncate audit_logs')).rejects.toThrow(/append-only/);
  });

  /*
   * audit_logs records actor and target ids as values rather than references. A
   * foreign key here would either block the delete or, with on delete set null,
   * demand an update the append-only trigger rejects.
   */
  it('keeps its history when a user it names is deleted', async () => {
    const { rows: created } = await pool.query<{ id: string }>(
      `insert into users (email, display_name)
       values ('deleted.user@audit-test.example.com', 'Deleted User')
       returning id`,
    );
    const userId = created[0]?.id;
    expect(userId).toBeDefined();

    await pool.query(
      `insert into audit_logs (action, actor_id, actor_email, target_user_id, target_user_email)
       values ('user.created', $1, 'deleted.user@audit-test.example.com', $1, 'deleted.user@audit-test.example.com')`,
      [userId],
    );

    await expect(pool.query('delete from users where id = $1', [userId])).resolves.toBeDefined();

    const { rows } = await pool.query<{ target_user_email: string; target_user_id: string }>(
      'select target_user_email, target_user_id from audit_logs where target_user_id = $1',
      [userId],
    );

    expect(rows).toEqual([
      {
        target_user_email: 'deleted.user@audit-test.example.com',
        target_user_id: userId,
      },
    ]);
  });
});

describe('GET /audit-logs', () => {
  it('returns the newest entries first', async () => {
    const res = await request(app).get('/audit-logs').set('X-Actor-Id', ADA);

    expect(res.status).toBe(200);

    const entries = res.body as AuditLogEntry[];
    expect(entries.length).toBeGreaterThan(0);

    /*
     * The id decides the order within one role change, whose rows share an
     * occurred_at. Compared as a number, because ids arrive as strings and "99" sorts
     * above "100" as text.
     */
    const descending = entries.every((entry, index) => {
      const previous = entries[index - 1];
      if (!previous) return true;

      return entry.occurredAt === previous.occurredAt
        ? Number(entry.id) < Number(previous.id)
        : entry.occurredAt < previous.occurredAt;
    });

    expect(descending).toBe(true);
  });

  it('caps how many entries it returns', async () => {
    const { rows } = await pool.query<{ count: number }>(
      'select count(*)::int as count from audit_logs',
    );
    const total = rows[0]?.count ?? 0;

    const res = await request(app).get('/audit-logs').set('X-Actor-Id', ADA);
    const entries = res.body as AuditLogEntry[];

    expect(entries.length).toBe(Math.min(total, HISTORY_LIMIT));
  });

  it('describes a user creation and a role change', async () => {
    /*
     * The suite's own activity supplies both kinds of entry, so this asserts on their
     * shape rather than on which rows are present or how many.
     */
    const res = await request(app).get('/audit-logs').set('X-Actor-Id', ADA);
    const entries = res.body as AuditLogEntry[];

    const created = entries.find((entry) => entry.action === 'user.created');
    expect(created).toBeDefined();
    expect(created?.roleKey).toBeNull();
    expect(created?.details).toEqual({});
    expect(created?.targetUserEmail).toMatch(/@/);
    expect(typeof created?.id).toBe('string');
    expect(new Date(created?.occurredAt ?? '').getTime()).not.toBeNaN();

    const roleChange = entries.find(
      (entry) => entry.action === 'role.granted' || entry.action === 'role.revoked',
    );
    expect(roleChange).toBeDefined();
    expect(roleChange?.roleKey).not.toBeNull();
    expect(roleChange?.details.before).toBeInstanceOf(Array);
    expect(roleChange?.details.after).toBeInstanceOf(Array);
  });

  it('allows an actor holding audit:read without users:create', async () => {
    const res = await request(app).get('/audit-logs').set('X-Actor-Id', ALAN);

    expect(res.status).toBe(200);
  });

  it('rejects an actor without audit:read', async () => {
    const res = await request(app).get('/audit-logs').set('X-Actor-Id', MARGARET);

    expect(res.status).toBe(403);
    expect((res.body as ErrorResponse).error.message).toMatch(/audit:read/);
  });

  it('rejects a request with no actor', async () => {
    const res = await request(app).get('/audit-logs');

    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error.code).toBe('missing_actor');
  });
});
