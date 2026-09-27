import type { ErrorCode } from '../../shared/errors.js';

const ERRORS = {
  missing_actor: { status: 401, message: 'X-Actor-Id header is required' },
  invalid_actor_id: { status: 400, message: 'X-Actor-Id must be a UUID' },
  unknown_actor: { status: 401, message: 'No user matches the X-Actor-Id header' },
  forbidden: { status: 403, message: 'You do not have permission to perform this action' },
  invalid_body: { status: 400, message: 'Request body is invalid' },
  email_taken: { status: 409, message: 'A user with that email already exists' },
  invalid_user_id: { status: 400, message: 'The user id in the path must be a UUID' },
  user_not_found: { status: 404, message: 'No user matches that id' },
  unknown_role: { status: 400, message: 'One or more of those roles do not exist' },
  last_admin: {
    status: 409,
    message: 'This change would leave nobody able to grant and revoke roles',
  },
  internal_error: { status: 500, message: 'Internal server error' },
} as const satisfies Record<ErrorCode, { status: number; message: string }>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? ERRORS[code].message);
    this.status = ERRORS[code].status;
    this.code = code;
    this.name = 'ApiError';
  }
}
