import type { PaginationMeta } from './ApiResponse';

/**
 * Reusable pagination helpers - used by every list endpoint.
 */

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface ResolvedPagination {
  page: number;
  limit: number;
  skip: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const resolvePagination = (
  opts: PaginationOptions = {},
): ResolvedPagination => {
  const page = Math.max(1, Number(opts.page) || DEFAULT_PAGE);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(opts.limit) || DEFAULT_LIMIT),
  );
  return { page, limit, skip: (page - 1) * limit };
};

export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
};
