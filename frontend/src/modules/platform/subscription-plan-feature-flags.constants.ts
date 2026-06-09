/** @deprecated Use subscription-feature-catalog — re-exported for backward compatibility. */
export {
  SUBSCRIPTION_FEATURE_CATALOG,
  SUBSCRIPTION_FEATURE_CATEGORIES,
  SUBSCRIPTION_FEATURE_KEYS,
  catalogFeatureLabel,
  type SubscriptionFeatureDefinition,
  type SubscriptionFeatureCategory,
} from '@/modules/subscription/subscription-feature-catalog';

import {
  SUBSCRIPTION_FEATURE_CATALOG,
  SUBSCRIPTION_FEATURE_KEYS,
  type SubscriptionFeatureDefinition,
} from '@/modules/subscription/subscription-feature-catalog';

export const SUBSCRIPTION_PLAN_FEATURE_FLAG_KEYS = SUBSCRIPTION_FEATURE_KEYS;

export type SubscriptionPlanFeatureFlagKey = (typeof SUBSCRIPTION_PLAN_FEATURE_FLAG_KEYS)[number];

export type SubscriptionPlanFeatureFlagOption = Pick<
  SubscriptionFeatureDefinition,
  'key' | 'label' | 'description'
>;

export const FEATURE_FLAG_OPTIONS: SubscriptionPlanFeatureFlagOption[] = SUBSCRIPTION_FEATURE_CATALOG.map(
  ({ key, label, description }) => ({ key, label, description }),
);

export type SubscriptionPlanFeatureFlagsFormValues = Record<SubscriptionPlanFeatureFlagKey, boolean>;
