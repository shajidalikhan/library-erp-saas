/**
 * Library / branch module constants.
 */

export const LIBRARY_STATUS = {
  ACTIVE: 'ACTIVE',
  TRIAL: 'TRIAL',
  SUSPENDED: 'SUSPENDED',
} as const;

export type LibraryStatus = (typeof LIBRARY_STATUS)[keyof typeof LIBRARY_STATUS];

export const SUBSCRIPTION_PLAN = {
  BASIC: 'BASIC',
  GROWTH: 'GROWTH',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
  /** Legacy — prefer {@link BASIC} with a trial instead of permanent free tier. */
  FREE: 'FREE',
  /** Legacy — use {@link BASIC}. */
  STARTER: 'STARTER',
} as const;

export type SubscriptionPlan =
  (typeof SUBSCRIPTION_PLAN)[keyof typeof SUBSCRIPTION_PLAN];

/** All persisted SKUs (legacy + current). Shared with validation `z.enum(...)`. */
export const SUBSCRIPTION_PLAN_VALUES = [
  SUBSCRIPTION_PLAN.FREE,
  SUBSCRIPTION_PLAN.STARTER,
  SUBSCRIPTION_PLAN.BASIC,
  SUBSCRIPTION_PLAN.GROWTH,
  SUBSCRIPTION_PLAN.PROFESSIONAL,
  SUBSCRIPTION_PLAN.ENTERPRISE,
] as const;

/** Billing / lifecycle separate from {@link LIBRARY_STATUS} (operational). */
export const SUBSCRIPTION_STATUS = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  CANCELLED: 'CANCELLED',
} as const;

export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const LIBRARY_SORT_FIELDS = ['createdAt', 'name', 'status', 'slug'] as const;
export type LibrarySortField = (typeof LIBRARY_SORT_FIELDS)[number];

export const BRANCH_SORT_FIELDS = ['createdAt', 'branchName', 'branchCode', 'totalSeats'] as const;
export type BranchSortField = (typeof BRANCH_SORT_FIELDS)[number];

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
