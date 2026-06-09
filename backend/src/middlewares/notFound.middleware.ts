import type { RequestHandler } from 'express';
import { ApiError } from '@utils/ApiError';

/**
 * Final route guard. Anything that reaches it has no matching route.
 */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};
