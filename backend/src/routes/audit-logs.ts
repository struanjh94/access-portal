import express from 'express';
import { PERMISSIONS } from '../../../shared/permissions.js';
import { requirePermission } from '../middleware/require-permission.js';
import { listAuditLogs } from '../services/audit-logs.js';

const auditLogsRouter = express.Router();

/**
 * Returns the most recent access changes, newest first.
 */
auditLogsRouter.get('/audit-logs', requirePermission(PERMISSIONS.AUDIT_READ), async (_req, res) => {
  res.json(await listAuditLogs());
});

export { auditLogsRouter };
