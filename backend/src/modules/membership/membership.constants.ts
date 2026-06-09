export const MEMBERSHIP_TYPE = {
  FULL_DAY: 'FULL_DAY',
  HALF_DAY: 'HALF_DAY',
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  EVENING: 'EVENING',
  NIGHT: 'NIGHT',
  CUSTOM_SHIFT: 'CUSTOM_SHIFT',
} as const;

export type MembershipType = (typeof MEMBERSHIP_TYPE)[keyof typeof MEMBERSHIP_TYPE];

export const MEMBERSHIP_STATUS = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  SUSPENDED: 'SUSPENDED',
  UPCOMING: 'UPCOMING',
} as const;

export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[keyof typeof MEMBERSHIP_STATUS];

export const DOWNGRADE_STATUS = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  NOT_REQUIRED: 'NOT_REQUIRED',
} as const;

export type DowngradeStatus = (typeof DOWNGRADE_STATUS)[keyof typeof DOWNGRADE_STATUS];
