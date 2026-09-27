import type { NextFunction, Request, Response } from 'express';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ErrorResponse } from '../../shared/errors.js';
import { pool } from '../src/db/client.js';
import { errorHandler } from '../src/middleware/error-handler.js';

afterAll(async () => {
  await pool.end();
});

/*
 * The handler touches only status, json and headersSent, so a stub recording
 * those is enough to assert what reaches the client.
 */
function stubResponse() {
  const sent: { status?: number; body?: ErrorResponse } = {};

  const res = {
    headersSent: false,
    status(code: number) {
      sent.status = code;
      return res;
    },
    json(body: ErrorResponse) {
      sent.body = body;
      return res;
    },
  };

  return { res: res as unknown as Response, sent };
}

const request = {} as Request;
const noop = (() => {}) as NextFunction;

describe('errorHandler', () => {
  it('turns an unrecognised error into a generic 500 without leaking its message', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { res, sent } = stubResponse();

    errorHandler(new Error('connection to host db-primary.internal failed'), request, res, noop);

    expect(sent.status).toBe(500);
    expect(sent.body?.error.code).toBe('internal_error');
    expect(JSON.stringify(sent.body)).not.toContain('db-primary.internal');
    expect(logged).toHaveBeenCalledOnce();

    logged.mockRestore();
  });
});
