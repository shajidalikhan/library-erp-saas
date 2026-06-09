import type { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types/api';

/**
 * Typed wrapper for API errors raised by the backend.
 * Use everywhere instead of `(err as any).response?.data?.message`.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(opts: {
    message: string;
    statusCode: number;
    code: string;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.details = opts.details;
  }

  static fromAxios(err: unknown): ApiError {
    const axiosErr = err as AxiosError<ApiErrorResponse>;
    const data = axiosErr.response?.data;
    if (data && typeof data === 'object' && 'success' in data) {
      return new ApiError({
        message: data.message || 'Request failed',
        statusCode: data.statusCode || axiosErr.response?.status || 500,
        code: data.code || 'API_ERROR',
        details: data.details,
      });
    }

    if (axiosErr.response) {
      return new ApiError({
        message: axiosErr.message || 'Request failed',
        statusCode: axiosErr.response.status,
        code: 'API_ERROR',
      });
    }

    if (axiosErr.code === 'ERR_NETWORK') {
      return new ApiError({
        message: 'Network error - please check your connection',
        statusCode: 0,
        code: 'NETWORK_ERROR',
      });
    }

    return new ApiError({
      message: (err as Error)?.message || 'Unexpected error',
      statusCode: 0,
      code: 'UNKNOWN_ERROR',
    });
  }

  /** True when the error is recoverable by retrying after re-auth. */
  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }
  /** True when the error indicates a missing permission. */
  get isForbidden(): boolean {
    return this.statusCode === 403;
  }
  /** True when the error is a Zod / validation failure. */
  get isValidation(): boolean {
    return this.statusCode === 422 || this.statusCode === 400;
  }
}
