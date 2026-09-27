import { z } from 'zod';
import { ApiError } from './errors.js';

/**
 * Validates a request body against a schema.
 *
 * @param schema Parsed with safeParse so a failure becomes an ApiError; a thrown
 *   ZodError would reach the error handler as an unexplained 500.
 * @param body req.body, typed unknown because express.json accepts any JSON.
 * @returns The parsed value, with the schema's trimming and lowercasing applied.
 * @throws ApiError invalid_body naming each field that failed.
 */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  const detail = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
    .join('; ');

  throw new ApiError('invalid_body', detail);
}

/**
 * Validates a user id taken from the path.
 *
 * @param value The raw path segment, typed unknown because Express widens req.params
 *   when a route carries middleware, so a string cannot be assumed.
 * @returns The id, once it is a well-formed UUID.
 * @throws ApiError invalid_user_id, which is a 400. z.guid rather than z.uuid,
 *   because z.uuid also enforces the RFC 9562 version and variant bits that the
 *   Postgres uuid type does not, so an id the database stores happily would be
 *   rejected as malformed instead of returning 404.
 */
export function parseUserId(value: unknown): string {
  const result = z.guid().safeParse(value);
  if (!result.success) throw new ApiError('invalid_user_id');
  return result.data;
}
