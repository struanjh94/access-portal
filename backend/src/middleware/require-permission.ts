import type { RequestHandler } from 'express';
import type { PermissionKey } from '../../../shared/permissions.js';
import { ApiError } from '../errors.js';
import { getActor } from './actor.js';

/**
 * Builds middleware that rejects the request unless the actor holds every one of
 * the requested permissions.
 *
 * Express calls middleware with (req, res, next) only, so the permissions live in
 * a closure: this runs once per route at startup, and the function it returns runs
 * on every request with `required` still in scope.
 *
 * @param required The permissions the actor must hold, all of them. At least one
 *   is required, so this cannot become middleware that allows everything.
 * @returns Middleware named `requirePermission`, so the deny-by-default test can
 *   find it in the Express router stack. An arrow function would be anonymous.
 * @throws ApiError forbidden when a permission is missing, or internal_error when
 *   the route did not run resolveActor first.
 */
export function requirePermission(
  ...required: [PermissionKey, ...PermissionKey[]]
): RequestHandler {
  return function requirePermission(req, _res, next) {
    const actor = getActor(req);

    const missing = required.filter((key) => !actor.permissions.includes(key));
    if (missing.length > 0) throw new ApiError('forbidden', `Requires ${missing.join(', ')}`);

    next();
  };
}
