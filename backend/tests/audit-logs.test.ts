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
});
