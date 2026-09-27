// as const ensures values are inferred as literal types (rather than type string)
export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  ROLES_READ: 'roles:read',
  ROLES_GRANT: 'roles:grant',
  ROLES_REVOKE: 'roles:revoke',
  AUDIT_READ: 'audit:read'
} as const;

// derives union of permission values from the object
export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

