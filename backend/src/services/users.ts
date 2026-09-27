import pg from 'pg';
import type { Actor, CreateUserBody, UserSummary } from '../../../shared/contract.js';
import { pool } from '../db/client.js';
import { withTransaction } from '../db/transaction.js';
import { ApiError } from '../errors.js';

/*
 * Unique on lower(email), so two casings of one address collide. pg reports the
 * index name in DatabaseError.constraint, which identifies this collision rather
 * than any unique violation the transaction might raise.
 */
const EMAIL_INDEX = 'users_email_lower_idx';

/**
 * Loads every user with the role keys they hold.
 *
 * Left joins so a user with no roles is still listed. The aggregate is sorted so
 * the array order is stable across calls, which lets a test compare it directly.
 */
const LIST_USERS = `
  select u.id,
         u.email,
         u.display_name as "displayName",
         u.created_at as "createdAt",
         coalesce(array_agg(ur.role_key order by ur.role_key) filter (where ur.role_key is not null), '{}') as roles
    from users u
    left join user_roles ur on ur.user_id = u.id
   group by u.id
   order by u.display_name
`;

/**
 * Inserts a user and returns them in the shape LIST_USERS returns.
 */
const INSERT_USER = `
  insert into users (email, display_name)
  values ($1, $2)
  returning id,
            email,
            display_name as "displayName",
            created_at as "createdAt",
            '{}'::text[] as roles
`;

const INSERT_AUDIT = `
  insert into audit_logs (action, actor_id, actor_email, target_user_id, target_user_email)
  values ('user.created', $1, $2, $3, $4)
`;

type UserRow = Omit<UserSummary, 'createdAt'> & { createdAt: Date };

/*
 * node-pg parses timestamptz into a Date. UserSummary describes the JSON the API
 * returns, so the conversion happens here rather than being left to res.json.
 */
function toUserSummary(row: UserRow): UserSummary {
  return { ...row, createdAt: row.createdAt.toISOString() };
}

/**
 * Lists all users with their roles.
 *
 * @returns Users sorted by display name, each with an empty roles array rather
 *   than an absent one when they hold none.
 */
export async function listUsers(): Promise<UserSummary[]> {
  const { rows } = await pool.query<UserRow>(LIST_USERS);
  return rows.map(toUserSummary);
}

/**
 * Creates a user and records the creation in the audit log.
 *
 * Both inserts share one transaction.
 *
 * @param actor The user performing the change, stamped onto the audit entry.
 * @param input Email and display name, already trimmed and lowercased by
 *   CreateUserBody.
 * @returns The created user, holding no roles until one is granted.
 * @throws ApiError email_taken when the address is already in use, ignoring case.
 *   Without this the driver's error would surface as a 500.
 */
export async function createUser(actor: Actor, input: CreateUserBody): Promise<UserSummary> {
  return withTransaction(async (client) => {
    try {
      const { rows } = await client.query<UserRow>(INSERT_USER, [input.email, input.displayName]);

      const created = rows[0];
      if (!created) throw new ApiError('internal_error');

      await client.query(INSERT_AUDIT, [actor.id, actor.email, created.id, created.email]);

      return toUserSummary(created);
    } catch (error) {
      if (error instanceof pg.DatabaseError && error.constraint === EMAIL_INDEX) {
        throw new ApiError('email_taken');
      }
      throw error;
    }
  });
}
