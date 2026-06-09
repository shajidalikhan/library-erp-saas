import { request } from '@/lib/axios';
import type { RecentActivityItem } from './types';

export const activityApi = {
  recent: (params?: { page?: number; limit?: number; libraryId?: string; branchId?: string }) =>
    request<{ items: RecentActivityItem[] }>({
      url: '/activity/recent',
      method: 'GET',
      params,
    }),
};
