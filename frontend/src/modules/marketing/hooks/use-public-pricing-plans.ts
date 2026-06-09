'use client';

import { useQuery } from '@tanstack/react-query';

import { request } from '@/lib/axios';
import { LANDING_PRICING_PLANS } from '@/modules/marketing/landing-content';

export const publicPricingPlansQueryKey = ['public-subscription-plans'] as const;

export type PublicPricingPlan = {
  id: string;
  planKey: string;
  displayName: string;
  description?: string;
  perfectFor?: string;
  highlights?: string[];
  monthlyPrice: number;
  yearlyPrice: number;
  currency?: string;
  mostPopular?: boolean;
};

function formatInr(amount: number): string {
  if (amount <= 0) return 'Custom';
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function usePublicPricingPlans() {
  return useQuery({
    queryKey: publicPricingPlansQueryKey,
    queryFn: async () => {
      const res = await request<{ items: PublicPricingPlan[] }>({
        url: '/public/platform/subscription-plans',
        method: 'GET',
      });
      return (res.items ?? []).map((p) => ({
        name: p.displayName,
        description: p.description ?? '',
        perfectFor: p.perfectFor ?? '',
        highlights:
          p.highlights?.length
            ? p.highlights
            : [`${p.planKey} plan`],
        featured: Boolean(p.mostPopular),
        monthlyPrice: formatInr(p.monthlyPrice),
        yearlyPrice: formatInr(p.yearlyPrice),
      }));
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function usePublicPricingPlansWithFallback() {
  const q = usePublicPricingPlans();
  return {
    ...q,
    data: q.data?.length ? q.data : LANDING_PRICING_PLANS,
  };
}
