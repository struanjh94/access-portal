import type { Request, Response, Router } from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '../../shared/contract.js';
import type { ErrorResponse } from '../../shared/errors.js';
import { PERMISSIONS } from '../../shared/permissions.js';
import { app } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { requirePermission } from '../src/middleware/require-permission.js';

afterAll(async () => {
  await pool.end();
});

const ADA = '11111111-1111-4111-8111-111111111111';

/*
 * requirePermission reads nothing but req.actor, so a stub carrying only that is
 * enough and these cases need no database or HTTP layer.
 */
function requestHolding(permissions: Actor['permissions']): Request {
  const actor: Actor = {
    id: ADA,
    email: 'ada.lovelace@example.com',
    displayName: 'Ada Lovelace',
    roles: [],
    permissions,
  };

  return { actor } as unknown as Request;
}

const response = {} as Response;
const noop = () => {};

describe('requirePermission', () => {
  it('passes the request on when the actor holds the permission', () => {
    let passedOn = false;

    requirePermission(PERMISSIONS.USERS_READ)(
      requestHolding([PERMISSIONS.USERS_READ]),
      response,
      () => {
        passedOn = true;
      },
    );

    expect(passedOn).toBe(true);
  });

  it('rejects an actor holding no permissions', () => {
    expect(() =>
      requirePermission(PERMISSIONS.USERS_READ)(requestHolding([]), response, noop),
    ).toThrow(/users:read/);
  });

  it('requires every permission, not just one of them', () => {
    expect(() =>
      requirePermission(PERMISSIONS.ROLES_GRANT, PERMISSIONS.ROLES_REVOKE)(
        requestHolding([PERMISSIONS.ROLES_GRANT]),
        response,
        noop,
      ),
    ).toThrow(/roles:revoke/);
  });

  /*
   * Express records middleware in the router stack by function name, and the
   * deny-by-default case below reads those names. An arrow function would be
   * anonymous, leaving that check passing while testing nothing.
   */
  it('returns a named function', () => {
    expect(requirePermission(PERMISSIONS.USERS_READ).name).toBe('requirePermission');
  });
});

describe('actor identity', () => {
  it('rejects a request with no actor header', async () => {
    const res = await request(app).get('/me');

    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error.code).toBe('missing_actor');
  });

  it('rejects an actor id that is not a UUID', async () => {
    const res = await request(app).get('/me').set('X-Actor-Id', 'not-a-uuid');

    expect(res.status).toBe(400);
    expect((res.body as ErrorResponse).error.code).toBe('invalid_actor_id');
  });

  it('rejects a well-formed actor id that matches no user', async () => {
    const res = await request(app)
      .get('/me')
      .set('X-Actor-Id', '99999999-9999-9999-9999-999999999999');

    expect(res.status).toBe(401);
    expect((res.body as ErrorResponse).error.code).toBe('unknown_actor');
  });
});

/*
 * /health answers the compose healthcheck, which sends no actor header. /me is how
 * an actor discovers what they may do, so gating it would lock out a user with no
 * roles — the people who most need an answer.
 */
const UNGATED_PATHS = ['/health', '/me'];

type RouteRecord = { path: string; handlers: string[] };

/*
 * Recurses rather than looking only inside mounted routers: a route registered
 * straight onto the app with app.get sits at the top level with its own .route,
 * and skipping those would let an unguarded route pass unnoticed.
 */
function collectRoutes(stack: Router['stack'], into: RouteRecord[]): void {
  for (const layer of stack) {
    if (layer.route) {
      into.push({ path: layer.route.path, handlers: layer.route.stack.map((h) => h.name) });
      continue;
    }

    const nested = (layer.handle as unknown as Partial<Router>).stack;
    if (nested) collectRoutes(nested, into);
  }
}

function registeredRoutes(): RouteRecord[] {
  const routes: RouteRecord[] = [];
  collectRoutes(app.router.stack, routes);
  return routes;
}

describe('deny by default', () => {
  it('leaves no route without a permission except the declared exemptions', () => {
    const routes = registeredRoutes();

    /*
     * Without this the check passes vacuously if Express changes how the router
     * stack is exposed and the walk stops finding anything.
     */
    expect(routes.map((route) => route.path)).toEqual(expect.arrayContaining(UNGATED_PATHS));

    const unguarded = routes
      .filter((route) => !UNGATED_PATHS.includes(route.path))
      .filter((route) => !route.handlers.includes('requirePermission'))
      .map((route) => route.path);

    expect(unguarded).toEqual([]);
  });
});
