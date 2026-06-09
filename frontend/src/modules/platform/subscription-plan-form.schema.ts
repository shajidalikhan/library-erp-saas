import { z } from 'zod';

import { SUBSCRIPTION_FEATURE_KEYS } from '@/modules/subscription/subscription-feature-catalog';
import type {
  SubscriptionPlanFeatureFlagKey,
  SubscriptionPlanFeatureFlagsFormValues,
} from '@/modules/platform/subscription-plan-feature-flags.constants';
import { SUBSCRIPTION_FEATURE_CATALOG } from '@/modules/subscription/subscription-feature-catalog';
import { displayNameToPlanKey, isValidPlanKey } from '@/modules/platform/subscription-plan-key.util';

const featureFlagsFormShape = SUBSCRIPTION_FEATURE_KEYS.reduce(
  (acc, key) => {
    acc[key] = z.boolean();
    return acc;
  },
  {} as Record<SubscriptionPlanFeatureFlagKey, z.ZodBoolean>,
);

const subscriptionPlanFeatureFlagsFormSchema = z.object(featureFlagsFormShape);

function preprocessNumeric(val: unknown): unknown {
  if (val === '' || val === null || val === undefined) return 0;
  if (typeof val === 'number' && Number.isNaN(val)) return 0;
  return val;
}

const nonNegativeIntField = z.preprocess(
  preprocessNumeric,
  z.coerce.number().int().min(0),
);

const priceField = z.preprocess(
  preprocessNumeric,
  z.coerce.number().min(0),
);

const planFormShared = z.object({
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().default(''),
  perfectFor: z.string().trim().max(300).optional().default(''),
  monthlyPrice: priceField,
  yearlyPrice: priceField,
  currency: z.string().trim().min(3).max(8).default('INR'),
  maxStudents: nonNegativeIntField,
  maxBranches: nonNegativeIntField,
  maxSeats: nonNegativeIntField,
  maxStaff: nonNegativeIntField,
  storageLimitMb: nonNegativeIntField,
  active: z.boolean(),
  mostPopular: z.boolean(),
  publicVisible: z.boolean(),
  trialDays: z.preprocess(preprocessNumeric, z.coerce.number().int().min(0).max(90)),
  sortOrder: nonNegativeIntField,
  featureFlags: subscriptionPlanFeatureFlagsFormSchema,
});

const planKeyField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((s) => displayNameToPlanKey(s))
  .refine((s) => s.length >= 2, 'Plan key must be at least 2 characters')
  .refine((s) => isValidPlanKey(s), 'Use A-Z, 0-9, and underscores only');

export const subscriptionPlanCreateFormSchema = planFormShared.extend({
  planKey: planKeyField,
});

export const subscriptionPlanEditFormSchema = planFormShared.extend({
  planKey: planKeyField,
});

export type SubscriptionPlanCreateFormValues = z.infer<typeof subscriptionPlanCreateFormSchema>;
export type SubscriptionPlanEditFormValues = z.infer<typeof subscriptionPlanEditFormSchema>;

export function defaultFeatureFlagsFormValues(): SubscriptionPlanFeatureFlagsFormValues {
  return Object.fromEntries(
    SUBSCRIPTION_FEATURE_CATALOG.map((f) => [f.key, f.defaultEnabled]),
  ) as SubscriptionPlanFeatureFlagsFormValues;
}

/** Merge stored plan flags with catalog defaults (ignores unknown legacy keys for the form). */
export function storedFeatureFlagsToFormValues(
  stored: Record<string, unknown> | undefined,
): SubscriptionPlanFeatureFlagsFormValues {
  const out = defaultFeatureFlagsFormValues();
  if (!stored || typeof stored !== 'object') return out;
  for (const key of SUBSCRIPTION_FEATURE_KEYS) {
    if (key in stored) out[key] = Boolean(stored[key]);
  }
  return out;
}

export function formFeatureFlagsToPayload(values: SubscriptionPlanFeatureFlagsFormValues): Record<string, boolean> {
  return { ...values };
}
