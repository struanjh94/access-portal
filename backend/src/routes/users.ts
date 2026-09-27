import express from 'express';
import { CreateUserBody } from '../../../shared/contract.js';
import { PERMISSIONS } from '../../../shared/permissions.js';
import { getActor } from '../middleware/actor.js';
import { requirePermission } from '../middleware/require-permission.js';
import { createUser, listUsers } from '../services/users.js';
import { parseBody } from '../validation.js';

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

export { usersRouter };
