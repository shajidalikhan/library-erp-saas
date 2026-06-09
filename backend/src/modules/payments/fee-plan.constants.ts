export const FEE_PLAN_TYPES = [
  'REGISTRATION',
  'MEMBERSHIP',
  'REGISTRATION_PLUS_MEMBERSHIP',
  'CUSTOM',
] as const;

export type FeePlanType = (typeof FEE_PLAN_TYPES)[number];

export const MINIMUM_START_AMOUNT_TYPES = ['ONE_MONTH', 'FIXED', 'PERCENTAGE'] as const;
export type MinimumStartAmountType = (typeof MINIMUM_START_AMOUNT_TYPES)[number];
