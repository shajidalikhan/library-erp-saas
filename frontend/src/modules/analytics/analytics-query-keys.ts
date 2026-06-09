import type { AnalyticsQueryParams } from './types';

export const analyticsQueryKeys = {
  all: ['analytics'] as const,
  overview: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'overview', p] as const,
  students: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'students', p] as const,
  seats: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'seats', p] as const,
  attendance: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'attendance', p] as const,
  revenue: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'revenue', p] as const,
  payments: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'payments', p] as const,
  branches: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'branches', p] as const,
  trendsDaily: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'trends-daily', p] as const,
  trendsMonthly: (p: AnalyticsQueryParams | undefined) => [...analyticsQueryKeys.all, 'trends-monthly', p] as const,
};
