import type { ErrorRequestHandler } from 'express';
import type { ErrorResponse } from '../../../shared/errors.js';
import { ApiError } from '../errors.js';

/*
 * Anything that is not already an ApiError is a bug, a dropped connection or a
 * database complaint, so this is the point where that is known and worth logging.
 * Its detail may carry a stack trace, a file path or a Postgres message naming
 * columns. Those details are logged, but not leaked to the client.
 */
function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  console.error('Unhandled error', error);
  return new ApiError('internal_error');
}

/**
 * Turns anything thrown during a request into the API's error response shape.
 *
 * Express identifies an error handler by counting its parameters, so all four
 * must stay declared even when unused. Register it last in app.ts — errors from
 * routes added after it are never caught.
 *
 * @param error Whatever was thrown. Express types it as any, so it is narrowed
 *   rather than trusted.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  /*
   * Once a response has started there is no way to replace it with an error body.
   */
  if (res.headersSent) {
    next(error);
    return;
  }

  const apiError = asApiError(error);
  const body: ErrorResponse = { error: { code: apiError.code, message: apiError.message } };

  res.status(apiError.status).json(body);
};
