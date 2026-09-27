export type ErrorCode =
  | 'missing_actor'
  | 'invalid_actor_id'
  | 'unknown_actor'
  | 'forbidden'
  | 'invalid_body'
  | 'email_taken'
  | 'invalid_user_id'
  | 'user_not_found'
  | 'unknown_role'
  | 'last_admin'
  | 'internal_error';

export type ErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
  };
};
