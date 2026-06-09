'use client';

import { useQuery } from '@tanstack/react-query';

import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

export type CatalogPlan = {
  _id?: string;
  id?: string;
  planKey: string;
  displayName: string;
  description?: string;
  perfectFor?: string;
  highlights?: string[];
  monthlyPrice?: number;
  yearlyPrice?: number;
  currency?: string;
  active?: boolean;
  mostPopular?: boolean;
  publicVisible?: boolean;
  trialDays?: number;
  sortOrder?: number;
  maxStudents?: number;
  maxBranches?: number;
  maxSeats?: number;
  maxStaff?: number;
  storageLimitMb?: number;
  featureFlags?: Record<string, boolean>;
};

export function usePlatformCatalogPlans(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? false;
  return useQuery({
    queryKey: [...platformQueryKeys.plans(), activeOnly ? 'active' : 'all'],
    queryFn: async () => {
      const res = await platformApi.plans();
      const items = (res.items ?? []) as CatalogPlan[];
      return activeOnly ? items.filter((p) => p.active !== false) : items;
    },
  });
}
