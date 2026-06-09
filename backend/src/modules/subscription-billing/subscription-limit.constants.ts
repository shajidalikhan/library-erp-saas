import { SUBSCRIPTION_PLAN } from '@modules/library/library.constants';

/** Resource types enforced before create. */
export const PLAN_LIMIT_ENTITY = {
  BRANCHES: 'branches',
  SEATS: 'seats',
  STAFF: 'staff',
  STUDENTS: 'students',
} as const;

export type PlanLimitEntity = (typeof PLAN_LIMIT_ENTITY)[keyof typeof PLAN_LIMIT_ENTITY];

export const USAGE_STATUS = {
  NORMAL: 'NORMAL',
  WARNING: 'WARNING',
  OVER_LIMIT: 'OVER_LIMIT',
} as const;

export type UsageStatus = (typeof USAGE_STATUS)[keyof typeof USAGE_STATUS];

/** Usage >= 80% of cap → warning (when cap is finite). */
export const PLAN_LIMIT_WARNING_RATIO = 0.8;

export const PLAN_LIMIT_AUDIT_ACTION = 'PLAN_LIMIT_BLOCKED' as const;

/** Plan keys treated as unlimited for enforcement. */
export const UNLIMITED_PLAN_KEYS = new Set<string>([SUBSCRIPTION_PLAN.ENTERPRISE]);

export const PLAN_LIMIT_MESSAGES: Record<PlanLimitEntity, string> = {
  [PLAN_LIMIT_ENTITY.BRANCHES]: 'Branch limit reached for current plan.',
  [PLAN_LIMIT_ENTITY.SEATS]: 'Seat capacity exceeded.',
  [PLAN_LIMIT_ENTITY.STAFF]: 'Staff limit reached.',
  [PLAN_LIMIT_ENTITY.STUDENTS]: 'Student profile limit reached.',
};
