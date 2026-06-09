import type { SubscriptionPlanEditFormValues } from '@/modules/platform/subscription-plan-form.schema';
import { formFeatureFlagsToPayload } from '@/modules/platform/subscription-plan-form.schema';
import { displayNameToPlanKey } from '@/modules/platform/subscription-plan-key.util';

/** Backend field names (PlatformSubscriptionPlan). */
export type SubscriptionPlanPatchBody = {
  planKey?: string;
  displayName: string;
  description: string;
  perfectFor: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  maxStudents: number;
  maxBranches: number;
  maxSeats: number;
  maxStaff: number;
  storageLimitMb: number;
  featureFlags: Record<string, boolean>;
  active: boolean;
  mostPopular: boolean;
  publicVisible: boolean;
  trialDays: number;
  sortOrder: number;
};

function parsePrice(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

function parseNonNegativeInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return 0;
}

/** Build a complete PATCH body with explicit false/0 values preserved. */
export function buildSubscriptionPlanPatchBody(
  body: SubscriptionPlanEditFormValues,
): SubscriptionPlanPatchBody {
  const payload: SubscriptionPlanPatchBody = {
    ...(body.planKey !== undefined && String(body.planKey).trim() !== ''
      ? { planKey: displayNameToPlanKey(String(body.planKey)) }
      : {}),
    displayName: body.displayName.trim(),
    description: (body.description ?? '').trim(),
    perfectFor: (body.perfectFor ?? '').trim(),
    monthlyPrice: parsePrice(body.monthlyPrice),
    yearlyPrice: parsePrice(body.yearlyPrice),
    currency: (body.currency ?? 'INR').trim().toUpperCase() || 'INR',
    maxStudents: parseNonNegativeInt(body.maxStudents),
    maxBranches: parseNonNegativeInt(body.maxBranches),
    maxSeats: parseNonNegativeInt(body.maxSeats),
    maxStaff: parseNonNegativeInt(body.maxStaff),
    storageLimitMb: parseNonNegativeInt(body.storageLimitMb),
    featureFlags: formFeatureFlagsToPayload(body.featureFlags),
    active: body.active === true,
    mostPopular: body.mostPopular === true,
    publicVisible: body.publicVisible === true,
    trialDays: parseNonNegativeInt(body.trialDays),
    sortOrder: parseNonNegativeInt(body.sortOrder),
  };

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[subscription-plan] PATCH payload', payload);
  }

  return payload;
}
