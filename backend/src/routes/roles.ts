import express from 'express';
import { PERMISSIONS } from '../../../shared/permissions.js';
import { requirePermission } from '../middleware/require-permission.js';
import { listRoles } from '../services/roles.js';

const rolesRouter = express.Router();

/**
 * Returns every role that can be granted.
 */
rolesRouter.get('/roles', requirePermission(PERMISSIONS.ROLES_READ), async (_req, res) => {
  res.json(await listRoles());
});

export { rolesRouter };
