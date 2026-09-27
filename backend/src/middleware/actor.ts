import type { Request, RequestHandler } from 'express';
import { z } from 'zod';
import type { Actor } from '../../../shared/contract.js';
import type { PermissionKey } from '../../../shared/permissions.js';
import { pool } from '../db/client.js';
import { ApiError } from '../errors.js';

/**
 * Loads one user with their roles and the permissions those roles grant.
 *
 * Left joins because a user with no roles must still resolve — an
 * inner join returns nothing for them, which is indistinguishable from an id
 * that doesn't exist. Permissions are deduplicated across the user's roles.
 */
const ACTOR_QUERY = `
  select u.id,
         u.email,
         u.display_name as "displayName",
         coalesce(array_agg(distinct ur.role_key) filter (where ur.role_key is not null), '{}') as roles,
         coalesce(array_agg(distinct rp.permission_key) filter (where rp.permission_key is not null), '{}') as permissions
    from users u
    left join user_roles ur on ur.user_id = u.id
    left join role_permissions rp on rp.role_key = ur.role_key
   where u.id = $1
   group by u.id
`;

type ActorRow = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: string[];
};

/**
 * Resolves the X-Actor-Id header into an actor and attaches it to the request.
 *
 * @throws ApiError If the header is absent, is not a UUID, or names no user.
 */
export const resolveActor: RequestHandler = async (req, _res, next) => {
  const actorId = req.get('X-Actor-Id');
  if (!actorId) throw new ApiError('missing_actor');

  /*
   * Use z.guid becuase z.uuid enforces the RFC 9562 version and variant bits,
   * which Postgres' uuid type does not. An id Postgres accepts can
   * fail z.uuid, giving 400 malformed instead of 401 unknown actor.
   * https://zod.dev/api
   */
  if (!z.guid().safeParse(actorId).success) throw new ApiError('invalid_actor_id');

  const { rows } = await pool.query<ActorRow>(ACTOR_QUERY, [actorId]);
  const actor = rows[0];
  if (!actor) throw new ApiError('unknown_actor');

  /*
   * Postgres returns actor.permissions as plain text. Narrowing to PermissionKey[] is safe
   * because a test asserts the permissions table matches the PERMISSIONS constant.
   */
  req.actor = { ...actor, permissions: actor.permissions as PermissionKey[] };

  next();
};

/**
 * Returns the actor attached by resolveActor.
 * This also narrows req.actor type from Actor | undefined to Actor.
 *
 * @throws ApiError If called on a route that does not run resolveActor
 */
export function getActor(req: Request): Actor {
  if (!req.actor) throw new ApiError('internal_error');
  return req.actor;
}
