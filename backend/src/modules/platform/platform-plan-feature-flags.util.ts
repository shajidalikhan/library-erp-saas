import { SUBSCRIPTION_FEATURE_KEYS } from '@modules/subscription-billing/subscription-feature-catalog';

/** Apply catalog feature flags from PATCH body; explicit false is preserved. */
export function mergeCatalogFeatureFlags(
  existing: Record<string, boolean> | null | undefined,
  incoming: Record<string, boolean>,
): Record<string, boolean> {
  const prev = existing ?? {};
  const out: Record<string, boolean> = {};
  for (const key of SUBSCRIPTION_FEATURE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(incoming, key)) {
      out[key] = incoming[key] === true;
    } else if (Object.prototype.hasOwnProperty.call(prev, key)) {
      out[key] = prev[key] === true;
    } else {
      out[key] = false;
    }
  }
  return out;
}
