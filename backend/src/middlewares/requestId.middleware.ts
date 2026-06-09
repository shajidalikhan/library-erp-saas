import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Attach a stable request id to every request. Useful for log correlation.
 */
export const requestIdMiddleware: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  next();
};
