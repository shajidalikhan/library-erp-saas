import { request } from '@/lib/axios';

import type {
  AnalyticsOverview,
  AnalyticsQueryParams,
  DailyTrendPoint,
  MonthlyTrendPoint,
} from './types';

function toParams(p?: AnalyticsQueryParams): Record<string, string> | undefined {
  if (!p) return undefined;
  const out: Record<string, string> = {};
  if (p.libraryId) out.libraryId = p.libraryId;
  if (p.branchId) out.branchId = p.branchId;
  if (p.fromDate) out.fromDate = p.fromDate;
  if (p.toDate) out.toDate = p.toDate;
  if (p.range) out.range = p.range;
  return Object.keys(out).length ? out : undefined;
}

export const analyticsApi = {
  overview: (params?: AnalyticsQueryParams) =>
    request<AnalyticsOverview>({ url: '/analytics/overview', method: 'GET', params: toParams(params) }),

  students: (params?: AnalyticsQueryParams) =>
    request<Record<string, unknown>>({ url: '/analytics/students', method: 'GET', params: toParams(params) }),

  seats: (params?: AnalyticsQueryParams) =>
    request<Record<string, unknown>>({ url: '/analytics/seats', method: 'GET', params: toParams(params) }),

  attendance: (params?: AnalyticsQueryParams) =>
    request<Record<string, unknown>>({ url: '/analytics/attendance', method: 'GET', params: toParams(params) }),

  revenue: (params?: AnalyticsQueryParams) =>
    request<{ trend: Array<{ date: string; amount: number }>; totalInRange: number; range: { from: string; to: string } }>({
      url: '/analytics/revenue',
      method: 'GET',
      params: toParams(params),
    }),

  payments: (params?: AnalyticsQueryParams) =>
    request<Record<string, unknown>>({ url: '/analytics/payments', method: 'GET', params: toParams(params) }),

  branches: (params?: AnalyticsQueryParams) =>
    request<{ branches: unknown[]; range: { from: string; to: string } }>({
      url: '/analytics/branches',
      method: 'GET',
      params: toParams(params),
    }),

  trendsDaily: (params?: AnalyticsQueryParams) =>
    request<{ series: DailyTrendPoint[]; range: { from: string; to: string } }>({
      url: '/analytics/trends/daily',
      method: 'GET',
      params: toParams(params),
    }),

  trendsMonthly: (params?: AnalyticsQueryParams) =>
    request<{ series: MonthlyTrendPoint[]; range: { from: string; to: string } }>({
      url: '/analytics/trends/monthly',
      method: 'GET',
      params: toParams(params),
    }),
};
