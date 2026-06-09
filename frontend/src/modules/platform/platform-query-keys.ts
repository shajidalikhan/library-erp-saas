export const platformQueryKeys = {
  all: ['platform'] as const,
  dashboard: () => [...platformQueryKeys.all, 'dashboard'] as const,
  health: () => [...platformQueryKeys.all, 'health'] as const,
  settings: () => [...platformQueryKeys.all, 'settings'] as const,
  tenants: (q: Record<string, string | undefined>) => [...platformQueryKeys.all, 'tenants', q] as const,
  tenant: (id: string) => [...platformQueryKeys.all, 'tenant', id] as const,
  subscriptionInvoices: (q: Record<string, string | undefined>) =>
    [...platformQueryKeys.all, 'subscription-invoices', q] as const,
  plans: () => [...platformQueryKeys.all, 'plans'] as const,
  plan: (id: string) => [...platformQueryKeys.all, 'plans', id] as const,
  audit: (q: Record<string, string | undefined>) => [...platformQueryKeys.all, 'audit', q] as const,
  demoRequests: (q: Record<string, string | undefined>) =>
    [...platformQueryKeys.all, 'demo-requests', q] as const,
  demoRequest: (id: string) => [...platformQueryKeys.all, 'demo-request', id] as const,
  usage: () => [...platformQueryKeys.all, 'usage'] as const,
};
