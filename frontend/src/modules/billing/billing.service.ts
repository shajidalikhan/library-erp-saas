import { request, requestDataAndMeta } from '@/lib/axios';

function cleanParams(p?: Record<string, string | undefined>): Record<string, string> | undefined {
  if (!p) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** SaaS tenant billing (library subscription), not student payments. */
export const billingApi = {
  supportConfig: () =>
    request<import('@/hooks/use-platform-support-config').PlatformSupportConfig>({
      url: '/billing/support-config',
      method: 'GET',
    }),
  subscription: () => request<Record<string, unknown>>({ url: '/billing/subscription', method: 'GET' }),
  effectiveFeatures: () =>
    request<Record<string, unknown>>({ url: '/billing/effective-features', method: 'GET' }),
  subscriptionSnapshot: () =>
    request<Record<string, unknown>>({ url: '/billing/subscription-snapshot', method: 'GET' }),
  /** Effective plan + tenant overrides (all tenant users with libraryId). */
  getEffectiveFeatures: () =>
    request<Record<string, unknown>>({ url: '/billing/effective-features', method: 'GET' }),
  invoices: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<{ items: unknown[]; meta: { pagination: unknown } }>({
      url: '/billing/subscription/invoices',
      method: 'GET',
      params: cleanParams(params),
    }),
  invoice: (invoiceId: string) =>
    request<Record<string, unknown>>({
      url: `/billing/subscription/invoices/${invoiceId}`,
      method: 'GET',
    }),
};
