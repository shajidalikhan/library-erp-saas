import type { ReportListParams } from './types';

const q = (p: ReportListParams) => JSON.stringify(p);

export const reportsQueryKeys = {
  root: ['reports'] as const,
  students: (p: ReportListParams) => [...reportsQueryKeys.root, 'students', q(p)] as const,
  attendance: (p: ReportListParams) => [...reportsQueryKeys.root, 'attendance', q(p)] as const,
  payments: (p: ReportListParams) => [...reportsQueryKeys.root, 'payments', q(p)] as const,
  invoices: (p: ReportListParams) => [...reportsQueryKeys.root, 'invoices', q(p)] as const,
  seats: (p: ReportListParams) => [...reportsQueryKeys.root, 'seats', q(p)] as const,
  dues: (p: ReportListParams) => [...reportsQueryKeys.root, 'dues', q(p)] as const,
  branches: (p: ReportListParams) => [...reportsQueryKeys.root, 'branches', q(p)] as const,
  collectionsDaily: (p: ReportListParams) => [...reportsQueryKeys.root, 'collections-daily', q(p)] as const,
  collectionsMonthly: (p: ReportListParams) => [...reportsQueryKeys.root, 'collections-monthly', q(p)] as const,
};
