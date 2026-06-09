'use client';

import { useQuery } from '@tanstack/react-query';

import { billingApi } from '@/modules/billing/billing.service';
import { request } from '@/lib/axios';
import { selectUser, useAuthStore } from '@/store/auth.store';
import { ROLES } from '@/constants/permissions';

export type PlatformSupportConfig = {
  supportEmail: string;
  salesEmail: string;
  supportPhone: string;
  billingPhone: string;
  whatsappSupport: string;
  showSupportEmail: boolean;
  showSupportPhone: boolean;
  showWhatsappSupport: boolean;
  showSalesEmail: boolean;
};

export const platformSupportQueryKey = ['platform', 'support-config'] as const;

async function fetchSupportConfig(isOwner: boolean): Promise<PlatformSupportConfig> {
  if (isOwner) {
    return billingApi.supportConfig();
  }
  return request<PlatformSupportConfig>({
    url: '/public/platform/support-config',
    method: 'GET',
  });
}

/** Platform support contacts + visibility flags from SaaS settings. */
export function usePlatformSupportConfig() {
  const user = useAuthStore(selectUser);
  const isOwner = user?.role === ROLES.LIBRARY_OWNER;

  const q = useQuery({
    queryKey: [...platformSupportQueryKey, isOwner ? 'owner' : 'public'],
    queryFn: () => fetchSupportConfig(Boolean(isOwner)),
    staleTime: 60_000,
  });

  const data = q.data;
  const hasAnyVisible = Boolean(
    data &&
      ((data.showSupportEmail && data.supportEmail) ||
        (data.showSupportPhone && data.supportPhone) ||
        (data.showWhatsappSupport && data.whatsappSupport) ||
        (data.showSalesEmail && data.salesEmail) ||
        data.billingPhone),
  );

  return {
    config: data,
    isLoading: q.isLoading,
    isError: q.isError,
    hasAnyVisible,
    refetch: q.refetch,
  };
}
