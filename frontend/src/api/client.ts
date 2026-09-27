import type { ErrorCode, ErrorResponse } from '../../../shared/errors.js';

/**
 * An error response from the API.
 *
 * Carries the code and the message the API sent, so a view can show the server's own
 * wording rather than inventing its own for every case.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'unexpected_response';

  constructor(status: number, code: ErrorCode | 'unexpected_response', message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'ApiError';
  }
}

/* Every request is proxied to the API under this prefix, by Vite in development and by nginx in the container. */
const API_BASE = '/api';

/**
 * Reads the error body, falling back to the status when it is not the API's shape.
 *
 * A proxy failure or a crash before the error handler runs returns HTML or nothing at
 * all, so the parse cannot be assumed to succeed.
 */
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ErrorResponse;
    return new ApiError(response.status, body.error.code, body.error.message);
  } catch {
    return new ApiError(
      response.status,
      'unexpected_response',
      `${response.status} ${response.statusText}`,
    );
  }
}

/**
 * Sends a request to the API as the given actor.
 *
 * @param path Path under /api, starting with a slash.
 * @param actorId Sent as X-Actor-Id, which is how the API identifies the caller.
 * @param body Serialised as JSON when present, which also decides the method.
 * @returns The parsed response body.
 * @throws ApiError For any non-2xx response, carrying the API's code and message.
 */
async function send<T>(
  path: string,
  actorId: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'X-Actor-Id': actorId,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) throw await toApiError(response);

  return (await response.json()) as T;
}

/**
 * Reads from the API.
 *
 * @throws ApiError For any non-2xx response.
 */
export function get<T>(path: string, actorId: string): Promise<T> {
  return send<T>(path, actorId, 'GET');
}

/**
 * Creates something through the API.
 *
 * @throws ApiError For any non-2xx response.
 */
export function post<T>(path: string, actorId: string, body: unknown): Promise<T> {
  return send<T>(path, actorId, 'POST', body);
}

/**
 * Replaces something through the API.
 *
 * @throws ApiError For any non-2xx response.
 */
export function put<T>(path: string, actorId: string, body: unknown): Promise<T> {
  return send<T>(path, actorId, 'PUT', body);
}
