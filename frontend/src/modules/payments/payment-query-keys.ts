export const paymentQueryKeys = {
  all: ['payments'] as const,
  feePlans: (params: unknown) => [...paymentQueryKeys.all, 'fee-plans', params] as const,
  invoices: (params: unknown) => [...paymentQueryKeys.all, 'invoices', params] as const,
  dues: (params: unknown) => [...paymentQueryKeys.all, 'dues', params] as const,
  overdue: (params: unknown) => [...paymentQueryKeys.all, 'overdue', params] as const,
  invoice: (id: string) => [...paymentQueryKeys.all, 'invoice', id] as const,
  payments: (params: unknown) => [...paymentQueryKeys.all, 'payments', params] as const,
  receipt: (id: string) => [...paymentQueryKeys.all, 'receipt', id] as const,
  history: (studentId: string) => [...paymentQueryKeys.all, 'history', studentId] as const,
  summary: (params: unknown) => [...paymentQueryKeys.all, 'summary', params] as const,
};
