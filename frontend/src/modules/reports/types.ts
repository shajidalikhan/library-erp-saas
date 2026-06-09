import type { AnalyticsRangePreset } from '@/modules/analytics/types';

export type ReportRangePreset = AnalyticsRangePreset;

export interface ReportListParams {
  libraryId?: string;
  branchId?: string;
  fromDate?: string;
  toDate?: string;
  range?: ReportRangePreset;
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  studentId?: string;
  seatId?: string;
  paymentMethod?: string;
  invoiceStatus?: string;
  columns?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ReportListEnvelope<T> {
  items: T[];
  meta: { pagination: PaginationMeta };
  range: { from: string; to: string };
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
