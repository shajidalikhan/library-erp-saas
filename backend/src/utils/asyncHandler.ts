import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async controller/middleware so any rejected promise is forwarded
 * to Express's centralized error handler.
 *
 * Usage:
 *   router.get('/x', asyncHandler(async (req, res) => { ... }));
 */
type AsyncRouteHandler<TReq extends Request = Request> = (
  req: TReq,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

export const asyncHandler =
  <TReq extends Request = Request>(fn: AsyncRouteHandler<TReq>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as TReq, res, next)).catch(next);
  };
