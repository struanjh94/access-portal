export type ErrorCode = 'missing_actor' | 'invalid_actor_id' | 'unknown_actor' | 'forbidden' | 'internal_error';

export type ErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
  };
};