import type { Actor, UpdateRolesBody, UserSummary } from '../../../shared/contract.js';
import { PERMISSIONS } from '../../../shared/permissions.js';
import { withTransaction } from '../db/transaction.js';
import { ApiError } from '../errors.js';

const SELECT_TARGET = `
  select id, email, display_name as "displayName", created_at as "createdAt"
    from users
   where id = $1
`;

const SELECT_KNOWN_ROLES = `select key from roles where key = any($1)`;

const SELECT_CURRENT_ROLES = `select role_key from user_roles where user_id = $1 order by role_key`;

const DELETE_ROLES = `delete from user_roles where user_id = $1 and role_key = any($2)`;

/**
 * Grants several roles in one statement.
 *
 * unnest turns the array parameter into rows, which keeps the number of round trips
 * fixed however many roles are granted.
 */
const INSERT_ROLES = `
  insert into user_roles (user_id, role_key, granted_by)
  select $1, role_key, $3
    from unnest($2::text[]) as role_key
`;

/**
 * Writes one audit row per role in the array, all carrying the same before and after
 * sets, so the log reads as one change made up of individual grants and revokes.
 */
const INSERT_AUDIT = `
  insert into audit_logs (action, actor_id, actor_email, target_user_id, target_user_email, role_key, details)
  select $1, $2, $3, $4, $5, role_key, $6::jsonb
    from unnest($7::text[]) as role_key
`;

/**
 * Finds any one user who can still manage access, and returns no rows when nobody
 * can.
 *
 * The invariant is expressed as permissions rather than a role name, so it holds
 * however roles are configured and is satisfied by two roles that combine to give a
 * user both keys. cardinality matches the number of keys passed, so the group must
 * cover all of them rather than any one.
 */
const SELECT_ACCESS_MANAGER = `
  select 1
    from user_roles ur
    join role_permissions rp on rp.role_key = ur.role_key
   where rp.permission_key = any($1)
   group by ur.user_id
  having count(distinct rp.permission_key) = cardinality($1::text[])
   limit 1
`;

/* Holding both is what makes a user able to manage access; neither is enough alone. */
const ACCESS_MANAGER_PERMISSIONS = [PERMISSIONS.ROLES_GRANT, PERMISSIONS.ROLES_REVOKE];

/**
 * Key for the advisory lock every role change takes. The number is arbitrary and
 * means nothing beyond being the same in each caller.
 */
const ROLE_CHANGE_LOCK = 8241;

type TargetRow = {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
};

/**
 * Replaces a user's roles with the submitted set, recording each grant and revoke.
 *
 * Runs as one transaction, so a user is never left holding a partly applied set and
 * the audit entries cannot survive without the change they describe.
 *
 * @param actor The user making the change, recorded on every audit row
 * @param targetUserId The user whose roles are being replaced.
 * @param input Role keys, already deduplicated and sorted by UpdateRolesBody.
 * @returns The target user with their new roles.
 * @throws ApiError user_not_found if no user has that id, unknown_role naming any
 *   submitted key that is not in the roles table, or last_admin when the change would
 *   leave nobody holding both roles:grant and roles:revoke.
 */
export async function updateUserRoles(
  actor: Actor,
  targetUserId: string,
  input: UpdateRolesBody,
): Promise<UserSummary> {
  return withTransaction(async (client) => {
    /*
     * Make role updates run one at a time: a second request asking for this same lock
     * waits here until the first transaction finishes.
     * Without this lock, two updates could run concurrently with a view of the DB before their own
     * transaction began, which creates the possibility of no user who can manage user roles.
     */
    await client.query('select pg_advisory_xact_lock($1::bigint)', [ROLE_CHANGE_LOCK]);

    /**
     * Selects the target user whose roles are changing
     * along with email and name for the audit log
     */
    const { rows: targets } = await client.query<TargetRow>(SELECT_TARGET, [targetUserId]);
    const target = targets[0];
    if (!target) throw new ApiError('user_not_found');

    /**
     * Validate all the requested roles exist in the roles table in the DB
     */
    const { rows: known } = await client.query<{ key: string }>(SELECT_KNOWN_ROLES, [input.roles]);
    const missing = input.roles.filter((key) => !known.some((row) => row.key === key));
    if (missing.length > 0) {
      throw new ApiError('unknown_role', `Unknown roles: ${missing.join(', ')}`);
    }

    /**
     * Select the roles the user currently holds, and
     * build an array containing just the role keys
     */
    const { rows: held } = await client.query<{ role_key: string }>(SELECT_CURRENT_ROLES, [
      targetUserId,
    ]);
    const current = held.map((row) => row.role_key);

    /**
     * Compute current vs requested roles for target user and build two arrays
     * showing role keys to be granted and revoked.
     */
    const granted = input.roles.filter((key) => !current.includes(key));
    const revoked = current.filter((key) => !input.roles.includes(key));

    /**
     * Audit entry should show precise before vs after state (not computed difference)
     */
    const details = JSON.stringify({ before: current, after: input.roles });
    const auditFields = [actor.id, actor.email, target.id, target.email, details];

    /**
     * Revoke roles from user if applicable and log it
     */
    if (revoked.length > 0) {
      await client.query(DELETE_ROLES, [targetUserId, revoked]);
      await client.query(INSERT_AUDIT, ['role.revoked', ...auditFields, revoked]);
    }

    /**
     * Grant roles to user if applicable and log it
     */
    if (granted.length > 0) {
      await client.query(INSERT_ROLES, [targetUserId, granted, actor.id]);
      await client.query(INSERT_AUDIT, ['role.granted', ...auditFields, granted]);
    }

    /**
     * Verify there is at least one remaining user who holds the permissions
     * needed to mananage user roles.
     * Otherwise rollback the whole transaction - apply nothing.
     */
    if (revoked.length > 0) {
      const { rows: managers } = await client.query(SELECT_ACCESS_MANAGER, [
        ACCESS_MANAGER_PERMISSIONS,
      ]);
      if (managers.length === 0) throw new ApiError('last_admin');
    }

    return { ...target, createdAt: target.createdAt.toISOString(), roles: input.roles };
  });
}
