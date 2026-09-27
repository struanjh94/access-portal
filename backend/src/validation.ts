import type { z } from 'zod';
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
