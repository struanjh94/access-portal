import type { AuditLogEntry } from '../../../shared/contract.js';
import { pool } from '../db/client.js';

/**
 * Select audit log entries sorted by most recent first.
 */
const LIST_AUDIT_LOGS = `
  select id,
         occurred_at as "occurredAt",
         action,
         actor_id as "actorId",
         actor_email as "actorEmail",
         target_user_id as "targetUserId",
         target_user_email as "targetUserEmail",
         role_key as "roleKey",
         details
    from audit_logs
   order by occurred_at desc, id desc
   limit $1
`;

/**
 * A fixed ceiling in place of pagination: the history grows without bound. Exported so
 * the test asserting the cap cannot drift from the value used here.
 */
export const HISTORY_LIMIT = 200;

type AuditLogRow = Omit<AuditLogEntry, 'occurredAt'> & { occurredAt: Date };

function toAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return { ...row, occurredAt: row.occurredAt.toISOString() };
}

/**
 * Lists the newest access changes.
 *
 * @returns At most HISTORY_LIMIT entries, newest first. The ids are strings because
 *   the column is bigserial and pg reads int8 as text.
 */
export async function listAuditLogs(): Promise<AuditLogEntry[]> {
  const { rows } = await pool.query<AuditLogRow>(LIST_AUDIT_LOGS, [HISTORY_LIMIT]);
  return rows.map(toAuditLogEntry);
}
