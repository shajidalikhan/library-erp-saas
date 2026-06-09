import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { ApiError } from '@utils/ApiError';

/**
 * Generic Zod request validator.
 * Validates body / query / params in a single pass and
 * stores parsed values on `req.validated*` without mutating
 * Express's readonly request properties.
 *
 * Usage:
 *   router.post('/x', validate({ body: createUserSchema }), controller);
 */
export interface ValidationSchemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

export const validate = (schemas: ValidationSchemas): RequestHandler => {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.validatedBody = schemas.body.parse(req.body);
      if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
      if (schemas.params) req.validatedParams = schemas.params.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(ApiError.unprocessable('Validation failed', err.flatten()));
        return;
      }
      next(err);
    }
  };
};
