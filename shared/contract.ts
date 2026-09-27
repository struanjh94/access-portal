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