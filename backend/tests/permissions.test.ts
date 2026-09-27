import { afterAll, describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../../shared/permissions.js';
import { pool } from '../src/db/client.js';

afterAll(async () => {
  await pool.end();
});

describe('permission keys', () => {
  /*
   * Guards the assumption actor.ts relies on when it narrows the text Postgres
   * returns to PermissionKey[]. A key in code but not the table is a route nobody
   * can satisfy; a key in the table but not code is policy nothing enforces.
   */
  it('match the permissions table exactly', async () => {
    const { rows } = await pool.query<{ key: string }>('select key from permissions order by key');

    expect(rows.map((row) => row.key)).toEqual([...Object.values(PERMISSIONS)].sort());
  });
});
