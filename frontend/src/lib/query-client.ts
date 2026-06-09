import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './api-error';

/**
 * Application-wide React Query client.
 * - Don't retry 401/403 - they need a re-auth, not another attempt.
 * - Don't retry 4xx validation errors either.
 */
export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (
              error.statusCode === 401 ||
              error.statusCode === 403 ||
              error.statusCode === 422 ||
              error.statusCode === 400
            ) {
              return false;
            }
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: 0,
      },
    },
  });
