import { HTTP_STATUS, type HttpStatusCode } from '@constants/http.constants';

/**
 * Custom error class.
 * Use throughout services / controllers instead of raw `throw new Error(...)`.
 * Centralized error handler will pick up `statusCode` and `details` automatically.
 */
export class ApiError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly code?: string;

  constructor(
    statusCode: HttpStatusCode,
    message: string,
    options: {
      details?: unknown;
      code?: string;
      isOperational?: boolean;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;
    this.code = options.code;
    if (options.cause) (this as unknown as { cause: unknown }).cause = options.cause;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad Request', details?: unknown): ApiError {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, { details, code: 'BAD_REQUEST' });
  }
  static unauthorized(message = 'Unauthorized', details?: unknown): ApiError {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message, { details, code: 'UNAUTHORIZED' });
  }
  static forbidden(message = 'Forbidden', details?: unknown): ApiError {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message, { details, code: 'FORBIDDEN' });
  }
  static notFound(message = 'Resource not found', details?: unknown): ApiError {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message, { details, code: 'NOT_FOUND' });
  }
  static conflict(message = 'Conflict', details?: unknown): ApiError {
    return new ApiError(HTTP_STATUS.CONFLICT, message, { details, code: 'CONFLICT' });
  }
  static unprocessable(message = 'Unprocessable entity', details?: unknown): ApiError {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message, {
      details,
      code: 'UNPROCESSABLE_ENTITY',
    });
  }
  static tooManyRequests(message = 'Too many requests'): ApiError {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message, { code: 'TOO_MANY_REQUESTS' });
  }
  static internal(message = 'Internal server error', details?: unknown): ApiError {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, {
      details,
      code: 'INTERNAL_SERVER_ERROR',
      isOperational: false,
    });
  }
}
