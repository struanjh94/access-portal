import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pool } from './client.js';
import { withTransaction } from './transaction.js';

// Resolved from the working directory, which is `backend/` in development and
// /app/backend in the container.
const MIGRATIONS_DIR = path.join(process.cwd(), 'db/migrations');

const MIGRATION_FILENAME = /^\d+_[a-z0-9_]+\.sql$/;

// Identifies the advisory lock that serialises migration runs.
const LOCK_KEY = 4815162342;

type AppliedMigration = {
  filename: string;
  checksum: string;
};

/**
 * Lists the migration files in the order they must be applied.
 *
 * @returns Filenames sorted by their zero-padded numeric prefix.
 * @throws Error If the directory cannot be read, or holds a `.sql` file whose
 *   name has no numeric prefix
 */
async function readMigrationFilenames(): Promise<string[]> {
  let entries: string[];

  try {
    entries = await readdir(MIGRATIONS_DIR);
  } catch (error) {
    throw new Error(`Cannot read the migrations directory at ${MIGRATIONS_DIR}`, { cause: error });
  }

  const sqlFiles = entries.filter((entry) => entry.endsWith('.sql'));
  const misnamed = sqlFiles.filter((entry) => !MIGRATION_FILENAME.test(entry));

  if (misnamed.length > 0) {
    throw new Error(`Migration filenames must start with a number: ${misnamed.join(', ')}`);
  }

  return sqlFiles.sort();
}

/**
 * Applies every migration file the database has not recorded yet.
 *
 * Holds a Postgres advisory lock for the whole run, so instances starting
 * together cannot apply the same file twice. Each file is applied in its own
 * transaction alongside the row recording it.
 *
 * @throws Error If an already-applied file no longer matches its recorded
 *   checksum.
 */
export async function migrate(): Promise<void> {
  const filenames = await readMigrationFilenames();
  const client = await pool.connect();

  try {
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);

    await client.query(`
      create table if not exists migrations (
        filename   text primary key,
        checksum   text not null,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query<AppliedMigration>(
      'select filename, checksum from migrations',
    );
    const applied = new Map(rows.map((row) => [row.filename, row.checksum]));

    for (const filename of filenames) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const recorded = applied.get(filename);

      if (recorded !== undefined) {
        if (recorded !== checksum) {
          throw new Error(
            `${filename} has changed since it was applied. Add a new migration rather than editing this one.`,
          );
        }
        continue;
      }

      await withTransaction(async (tx) => {
        await tx.query(sql);
        await tx.query('insert into migrations (filename, checksum) values ($1, $2)', [
          filename,
          checksum,
        ]);
      });

      console.log(`Applied migration ${filename}`);
    }
  } finally {
    try {
      await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
    } catch (error) {
      console.error('Failed to release the migration lock', error);
    }
    client.release();
  }
}
