import { request } from '@/lib/axios';
import type { SearchResultItem } from './types';

export const searchApi = {
  global: (q: string, limit = 12) =>
    request<{ items: SearchResultItem[] }>({
      url: '/search',
      method: 'GET',
      params: { q, limit },
    }),
};
