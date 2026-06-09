import { request, requestDataAndMeta } from '@/lib/axios';

function cleanParams(p?: Record<string, string | undefined>): Record<string, string> | undefined {
  if (!p) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export const platformApi = {
  dashboard: () => request<Record<string, unknown>>({ url: '/platform/dashboard', method: 'GET' }),
  health: () => request<Record<string, unknown>>({ url: '/platform/health', method: 'GET' }),
  settings: () => request<Record<string, unknown>>({ url: '/platform/settings', method: 'GET' }),
  patchSettings: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>({ url: '/platform/settings', method: 'PATCH', data: body }),
  tenants: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<{ items: unknown[]; meta: { pagination: unknown } }>({
      url: '/platform/tenants',
      method: 'GET',
      params: cleanParams(params),
    }),
  tenant: (libraryId: string) =>
    request<{
      library: Record<string, unknown>;
      usage: Record<string, unknown>;
      billingSnapshot?: Record<string, unknown>;
    }>({
      url: `/platform/tenants/${libraryId}`,
      method: 'GET',
    }),
  patchTenant: (libraryId: string, body: Record<string, unknown>) =>
    request<{ library: Record<string, unknown>; usage: Record<string, unknown> }>({
      url: `/platform/tenants/${libraryId}`,
      method: 'PATCH',
      data: body,
    }),
  suspendTenant: (libraryId: string, body: { reason: string }) =>
    request<{ library: Record<string, unknown>; usage: Record<string, unknown> }>({
      url: `/platform/tenants/${libraryId}/suspend`,
      method: 'PATCH',
      data: body,
    }),
  activateTenant: (libraryId: string) =>
    request<{ library: Record<string, unknown>; usage: Record<string, unknown> }>({
      url: `/platform/tenants/${libraryId}/activate`,
      method: 'PATCH',
    }),
  plans: () => request<{ items: unknown[] }>({ url: '/platform/subscriptions/plans', method: 'GET' }),
  plan: (planId: string) =>
    request<Record<string, unknown>>({ url: `/platform/subscriptions/plans/${planId}`, method: 'GET' }),
  createPlan: (body: Record<string, unknown>) =>
    request<unknown>({ url: '/platform/subscriptions/plans', method: 'POST', data: body }),
  patchPlan: (planId: string, body: Record<string, unknown>) =>
    request<unknown>({ url: `/platform/subscriptions/plans/${planId}`, method: 'PATCH', data: body }),
  auditLogs: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<{ items: unknown[]; meta: { pagination: unknown } }>({
      url: '/platform/audit-logs',
      method: 'GET',
      params: cleanParams(params),
    }),
  usage: () => request<Record<string, unknown>>({ url: '/platform/usage', method: 'GET' }),
  snapshots: () => request<{ librariesProcessed: number; snapshotAt: string }>({
    url: '/platform/usage/snapshots',
    method: 'POST',
  }),
  announcement: (body: { title: string; message: string; type?: string }) =>
    request<{ sent: number }>({ url: '/platform/announcements', method: 'POST', data: body }),
  demoRequests: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<{ items: unknown[]; meta: { pagination: unknown } }>({
      url: '/platform/demo-requests',
      method: 'GET',
      params: cleanParams(params),
    }),
  demoRequest: (requestId: string) =>
    request<Record<string, unknown>>({
      url: `/platform/demo-requests/${requestId}`,
      method: 'GET',
    }),
  patchDemoRequest: (requestId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>({
      url: `/platform/demo-requests/${requestId}`,
      method: 'PATCH',
      data: body,
    }),
  impersonationPolicy: () => request<Record<string, unknown>>({ url: '/platform/impersonation/policy', method: 'GET' }),
  subscriptionInvoices: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<{ items: unknown[]; meta: { pagination: unknown } }>({
      url: '/platform/subscription-invoices',
      method: 'GET',
      params: cleanParams(params),
    }),
  subscriptionInvoice: (invoiceId: string) =>
    request<Record<string, unknown>>({
      url: `/platform/subscription-invoices/${invoiceId}`,
      method: 'GET',
    }),
  createSubscriptionInvoice: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>({ url: '/platform/subscription-invoices', method: 'POST', data: body }),
  collectSubscriptionInvoice: (invoiceId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>({
      url: `/platform/subscription-invoices/${invoiceId}/collect`,
      method: 'POST',
      data: body,
    }),
  cancelSubscriptionInvoice: (invoiceId: string, body?: Record<string, unknown>) =>
    request<Record<string, unknown>>({
      url: `/platform/subscription-invoices/${invoiceId}/cancel`,
      method: 'PATCH',
      data: body ?? {},
    }),
  librarySubscription: (libraryId: string) =>
    request<{ subscription: Record<string, unknown>; snapshot: Record<string, unknown>; timeline: unknown[] }>({
      url: `/platform/tenants/${libraryId}/subscription`,
      method: 'GET',
    }),
  subscriptionSnapshot: (libraryId: string) =>
    request<Record<string, unknown>>({
      url: `/platform/tenants/${libraryId}/subscription-snapshot`,
      method: 'GET',
    }),
  adjustLibrarySubscription: (libraryId: string, body: Record<string, unknown>) =>
    request<{ subscription: Record<string, unknown>; snapshot: Record<string, unknown>; timeline: unknown[] }>({
      url: `/platform/tenants/${libraryId}/subscription/adjust`,
      method: 'PATCH',
      data: body,
    }),
  extendLibraryTrial: (libraryId: string, body: Record<string, unknown>) =>
    request<{ subscription: Record<string, unknown>; snapshot: Record<string, unknown>; timeline: unknown[] }>({
      url: `/platform/tenants/${libraryId}/subscription/extend-trial`,
      method: 'POST',
      data: body,
    }),
  syncLibrarySubscription: (libraryId: string) =>
    request<{ subscription: Record<string, unknown>; snapshot: Record<string, unknown>; timeline: unknown[] }>({
      url: `/platform/tenants/${libraryId}/subscription/sync`,
      method: 'POST',
    }),
  patchTenantFeatureOverrides: (libraryId: string, body: Record<string, unknown>) =>
    request<Record<string, unknown>>({
      url: `/platform/tenants/${libraryId}/feature-overrides`,
      method: 'PATCH',
      data: body,
    }),
  getRoleCapabilities: () =>
    request<{
      roles: string[];
      modules: string[];
      moduleActions: Record<string, readonly string[]>;
      matrix: Record<string, Record<string, Record<string, boolean>>>;
      defaults: Record<string, Record<string, Record<string, boolean>>>;
      moduleFlags: Record<string, Record<string, boolean>>;
    }>({ url: '/platform/role-capabilities', method: 'GET' }),
  patchRoleCapabilities: (
    role: string,
    patch: { modules?: Record<string, boolean>; actions?: Record<string, Record<string, boolean>> },
  ) =>
    request<{
      updated: Record<string, Record<string, boolean>>;
      roles: string[];
      modules: string[];
      matrix: Record<string, Record<string, Record<string, boolean>>>;
      moduleFlags: Record<string, Record<string, boolean>>;
    }>({
      url: '/platform/role-capabilities',
      method: 'PATCH',
      data: { role, ...patch },
    }),
};