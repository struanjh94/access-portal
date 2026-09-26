import type { PoolClient } from 'pg';
import { pool } from './client.js';

/**
 * Runs a function inside a transaction on a single pooled connection, and
 * commits when it resolves or rolls back when it throws.
 *
 * @param fn Every query in the transaction must use the client it receives;
 *   `pool.query` would take a different connection and run outside it.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    // Report a failed rollback rather than throwing it, so the original error
    // is the one that reaches the caller.
    try {
      await client.query('rollback');
    } catch (rollbackError) {
      console.error('Transaction rollback failed', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}
