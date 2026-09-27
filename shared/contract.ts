import type { PermissionKey } from './permissions.js';

export type Actor = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  permissions: PermissionKey[];
};