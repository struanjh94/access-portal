import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/client.js';

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
