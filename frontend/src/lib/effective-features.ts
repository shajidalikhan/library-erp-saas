import { SUBSCRIPTION_FEATURE_KEYS } from '@/modules/subscription/subscription-feature-catalog';

export const PUBLIC_BOOKING_FEATURE_KEY = 'public_booking';

export type FeatureAccessSnapshot = {
  planFeatures?: Record<string, boolean>;
  features?: Record<string, boolean>;
  enabledFeaturesOverride?: string[];
  disabledFeaturesOverride?: string[];
  included?: Array<{ key: string; label: string }>;
};

export type SubscriptionSnapshotLike = Record<string, unknown> | null | undefined;

export type FeatureOverrideContext = {
  enabledFeaturesOverride?: string[];
  disabledFeaturesOverride?: string[];
};

/** Read effective feature map from billing/platform subscription snapshot payload. */
export function extractSnapshotEffectiveFeatures(
  snap: SubscriptionSnapshotLike,
): Record<string, boolean> {
  if (!snap) return {};
  const access = snap.featureAccess as FeatureAccessSnapshot | undefined;
  const fromAccess = access?.features;
  const fromEffective = snap.effectiveFeatures as Record<string, boolean> | undefined;
  const fromFlags = snap.featureFlags as Record<string, boolean> | undefined;
  const fromRoot = snap.features as Record<string, boolean> | undefined;
  const base = fromAccess ?? fromEffective ?? fromFlags ?? fromRoot ?? {};
  const out = { ...base };
  for (const row of access?.included ?? []) {
    if (row?.key) out[row.key] = true;
  }
  const enabled =
    access?.enabledFeaturesOverride ??
    (snap.enabledFeaturesOverride as string[] | undefined) ??
    [];
  const disabled =
    access?.disabledFeaturesOverride ??
    (snap.disabledFeaturesOverride as string[] | undefined) ??
    [];
  for (const key of disabled) {
    out[key] = false;
  }
  for (const key of enabled) {
    out[key] = true;
  }
  return out;
}

export function applyFeatureOverrideLists(
  features: Record<string, boolean>,
  overrides?: FeatureOverrideContext,
): Record<string, boolean> {
  const out = { ...features };
  for (const key of overrides?.disabledFeaturesOverride ?? []) {
    if (SUBSCRIPTION_FEATURE_KEYS.includes(key as (typeof SUBSCRIPTION_FEATURE_KEYS)[number])) {
      out[key] = false;
    }
  }
  for (const key of overrides?.enabledFeaturesOverride ?? []) {
    if (SUBSCRIPTION_FEATURE_KEYS.includes(key as (typeof SUBSCRIPTION_FEATURE_KEYS)[number])) {
      out[key] = true;
    }
  }
  return out;
}

/**
 * Merge auth + snapshot into one effective map.
 * When a snapshot has been fetched successfully, it wins over stale auth for each key.
 */
export function mergeEffectiveFeatures(opts: {
  fromAuth?: Record<string, boolean>;
  snapshot?: SubscriptionSnapshotLike;
  snapshotReady?: boolean;
  enabledFeaturesOverride?: string[];
  disabledFeaturesOverride?: string[];
}): Record<string, boolean> {
  const fromAuth = opts.fromAuth ?? {};
  const fromSnap = extractSnapshotEffectiveFeatures(opts.snapshot);

  let merged: Record<string, boolean>;
  if (opts.snapshotReady && Object.keys(fromSnap).length > 0) {
    merged = { ...fromAuth, ...fromSnap };
  } else {
    merged = { ...fromAuth, ...fromSnap };
    for (const key of SUBSCRIPTION_FEATURE_KEYS) {
      if (fromAuth[key] === true || fromSnap[key] === true) merged[key] = true;
    }
  }

  return applyFeatureOverrideLists(merged, {
    enabledFeaturesOverride:
      opts.enabledFeaturesOverride ??
      (opts.snapshot?.featureAccess as FeatureAccessSnapshot | undefined)
        ?.enabledFeaturesOverride ??
      (opts.snapshot?.enabledFeaturesOverride as string[] | undefined),
    disabledFeaturesOverride:
      opts.disabledFeaturesOverride ??
      (opts.snapshot?.featureAccess as FeatureAccessSnapshot | undefined)
        ?.disabledFeaturesOverride ??
      (opts.snapshot?.disabledFeaturesOverride as string[] | undefined),
  });
}

export function hasEffectiveFeature(
  features: Record<string, boolean> | undefined,
  key: string,
  overrides?: FeatureOverrideContext,
): boolean {
  if (overrides?.disabledFeaturesOverride?.includes(key)) return false;
  if (overrides?.enabledFeaturesOverride?.includes(key)) return true;
  return Boolean(features && features[key] === true);
}
