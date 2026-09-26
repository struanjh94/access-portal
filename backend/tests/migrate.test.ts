import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '../src/db/client.js';
import { migrate } from '../src/db/migrate.js';

afterAll(async () => {
  await pool.end();
});

describe('migrate', () => {
  it('records every migration file with a checksum', async () => {
    const { rows } = await pool.query<AppliedRow>(
      'select filename, checksum from migrations order by filename',
    );

    expect(rows.map((row) => row.filename)).toEqual(['001_schema.sql', '002_seed.sql']);

    for (const row of rows) {
      expect(row.checksum).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('applies nothing on a second run', async () => {
    const before = await pool.query<AppliedRow>(
      'select filename, checksum from migrations order by filename',
    );

    await migrate();

    const after = await pool.query<AppliedRow>(
      'select filename, checksum from migrations order by filename',
    );

    expect(after.rows).toEqual(before.rows);
  });
});

type AppliedRow = {
  filename: string;
  checksum: string;
};
