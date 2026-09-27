import { z } from 'zod';
import type { PermissionKey } from './permissions.js';

export type Actor = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: PermissionKey[];
};

export type UserSummary = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  roles: string[];
};

export const CreateUserBody = z.strictObject({
  email: z.string().trim().max(254).toLowerCase().pipe(z.email()),
  displayName: z.string().trim().min(1).max(120),
});

export type CreateUserBody = z.infer<typeof CreateUserBody>;

export const UpdateRolesBody = z.strictObject({
  roles: z
    .array(z.string().trim().min(1).max(64))
    .max(20)
    .transform((keys) => [...new Set(keys)].sort()),
});

export type UpdateRolesBody = z.infer<typeof UpdateRolesBody>;

export type AuditDetails = {
  before?: string[];
  after?: string[];
};

export type AuditLogEntry = {
  id: string;
  occurredAt: string;
  action: 'user.created' | 'role.granted' | 'role.revoked';
  actorId: string | null;
  actorEmail: string;
  targetUserId: string | null;
  targetUserEmail: string;
  roleKey: string | null;
  details: AuditDetails;
};
