import type { Response } from 'express';
import { HTTP_STATUS, type HttpStatusCode } from '@constants/http.constants';

/**
 * Reusable API response utility.
 * Every success response in the system must use these helpers so the
 * frontend can rely on a single, predictable contract.
 *
 * Shape:
 * {
 *   success: true,
 *   statusCode,
 *   message,
 *   data,            // optional payload
 *   meta?: { pagination, ... },
 * }
 */

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponseMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

export interface ApiResponseBody<T> {
  success: true;
  statusCode: HttpStatusCode;
  message: string;
  data: T;
  meta?: ApiResponseMeta;
}

export class ApiResponse {
  static ok<T>(
    res: Response,
    data: T,
    message = 'OK',
    meta?: ApiResponseMeta,
  ): Response<ApiResponseBody<T>> {
    return ApiResponse.send(res, HTTP_STATUS.OK, message, data, meta);
  }

  static created<T>(
    res: Response,
    data: T,
    message = 'Created',
    meta?: ApiResponseMeta,
  ): Response<ApiResponseBody<T>> {
    return ApiResponse.send(res, HTTP_STATUS.CREATED, message, data, meta);
  }

  static noContent(res: Response): Response {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
  }

  static send<T>(
    res: Response,
    statusCode: HttpStatusCode,
    message: string,
    data: T,
    meta?: ApiResponseMeta,
  ): Response<ApiResponseBody<T>> {
    const body: ApiResponseBody<T> = { success: true, statusCode, message, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
  }
}
