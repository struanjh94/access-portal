import express from 'express';
import { CreateUserBody, UpdateRolesBody } from '../../../shared/contract.js';
import { PERMISSIONS } from '../../../shared/permissions.js';
import { getActor } from '../middleware/actor.js';
import { requirePermission } from '../middleware/require-permission.js';
import { updateUserRoles } from '../services/roles.js';
import { createUser, listUsers } from '../services/users.js';
import { parseBody, parseUserId } from '../validation.js';

const usersRouter = express.Router();

/**
 * Returns every user with the roles they hold.
 */
usersRouter.get('/users', requirePermission(PERMISSIONS.USERS_READ), async (_req, res) => {
  res.json(await listUsers());
});

/**
 * Creates a user with no roles.
 * Roles must be granted seperately.
 */
usersRouter.post('/users', requirePermission(PERMISSIONS.USERS_CREATE), async (req, res) => {
  const created = await createUser(getActor(req), parseBody(CreateUserBody, req.body));
  res.status(201).json(created);
});

/**
 * Replaces a user's roles with the submitted set.
 */
usersRouter.put(
  '/users/:id/roles',
  requirePermission(PERMISSIONS.ROLES_GRANT, PERMISSIONS.ROLES_REVOKE),
  async (req, res) => {
    const updated = await updateUserRoles(
      getActor(req),
      parseUserId(req.params.id),
      parseBody(UpdateRolesBody, req.body),
    );

    res.json(updated);
  },
);

export { usersRouter };
