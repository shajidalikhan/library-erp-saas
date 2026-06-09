import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { TokenExpiredError, JsonWebTokenError, NotBeforeError } from 'jsonwebtoken';

import { ApiError } from '@utils/ApiError';
import { logger } from '@utils/logger';
import { ENV } from '@config/env.config';
import { HTTP_STATUS } from '@constants/http.constants';

/**
 * Centralized error handler.
 * - Maps known error types -> ApiError with correct status + payload.
 * - Hides internal stack traces in production.
 */

interface ErrorBody {
  success: false;
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

const toApiError = (err: unknown): ApiError => {
  if (err instanceof ApiError) return err;

  if (err instanceof ZodError) {
    return ApiError.unprocessable('Validation failed', err.flatten());
  }

  if (err instanceof TokenExpiredError) {
    return ApiError.unauthorized('Token expired', { name: err.name });
  }
  if (err instanceof NotBeforeError) {
    return ApiError.unauthorized('Token not active yet', { name: err.name });
  }
  if (err instanceof JsonWebTokenError) {
    return ApiError.unauthorized('Invalid token', { name: err.name });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    return ApiError.unprocessable('Database validation failed', err.errors);
  }
  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid ${err.path}: ${String(err.value)}`);
  }

  if (typeof err === 'object' && err && 'code' in err && (err as { code: number }).code === 11000) {
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue;
    return ApiError.conflict('Duplicate field value', { keyValue });
  }

  if (err instanceof Error) {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, err.message || 'Internal server error', {
      isOperational: false,
      cause: err,
    });
  }

  return ApiError.internal('Unknown error');
};

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  const apiErr = toApiError(err);

  if (!apiErr.isOperational || apiErr.statusCode >= 500) {
    logger.error(
      `Unhandled error on ${req.method} ${req.originalUrl}:`,
      apiErr,
    );
  } else {
    logger.warn(
      `Operational error on ${req.method} ${req.originalUrl}: ${apiErr.message}`,
    );
  }

  const body: ErrorBody = {
    success: false,
    statusCode: apiErr.statusCode,
    code: apiErr.code ?? 'ERROR',
    message: apiErr.message,
  };
  if (apiErr.details !== undefined) body.details = apiErr.details;
  if (!ENV.IS_PROD && apiErr.stack) body.stack = apiErr.stack;

  res.status(apiErr.statusCode).json(body);
};
