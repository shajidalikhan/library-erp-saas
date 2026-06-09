import type { PlanLimitEntity } from '@/modules/subscription/subscription-usage.types';

export const PLAN_LIMIT_TOOLTIPS: Record<PlanLimitEntity, string> = {
  branches: 'Upgrade your subscription to add more branches.',
  seats: 'Upgrade your subscription to add more seats.',
  staff: 'Upgrade your subscription to add more staff.',
  students: 'Upgrade your subscription to add more student profiles.',
};

export const FEATURE_UPGRADE_TOOLTIPS: Record<string, string> = {
  exports: 'Upgrade your plan to unlock CSV, Excel, and PDF exports.',
  analytics: 'Upgrade your plan to unlock analytics.',
  reports: 'Upgrade your plan to unlock reports.',
  notifications: 'Upgrade your plan to unlock notifications.',
  qr_attendance: 'Upgrade your plan to unlock QR attendance.',
  multi_branch: 'Upgrade your plan to add more branches.',
};

export function isAtCreateCap(metric: { used: number; limit: number | null; unlimited: boolean }): boolean {
  if (metric.unlimited || metric.limit === null) return false;
  return metric.used >= metric.limit;
}
