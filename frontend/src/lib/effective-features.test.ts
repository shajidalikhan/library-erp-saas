import { describe, expect, it } from 'vitest';

import {
  extractSnapshotEffectiveFeatures,
  hasEffectiveFeature,
  mergeEffectiveFeatures,
  PUBLIC_BOOKING_FEATURE_KEY,
} from './effective-features';

describe('effective-features', () => {
  it('enabled override makes public_booking true in snapshot extract', () => {
    const features = extractSnapshotEffectiveFeatures({
      featureAccess: {
        features: { public_booking: true },
        enabledFeaturesOverride: ['public_booking'],
        included: [{ key: 'public_booking', label: 'Public Booking' }],
      },
      featureFlags: { public_booking: true },
    });
    expect(features.public_booking).toBe(true);
    expect(hasEffectiveFeature(features, PUBLIC_BOOKING_FEATURE_KEY)).toBe(true);
  });

  it('snapshot wins over stale auth when snapshot is ready', () => {
    const merged = mergeEffectiveFeatures({
      fromAuth: { public_booking: false },
      snapshot: {
        featureAccess: {
          features: { public_booking: true },
          enabledFeaturesOverride: ['public_booking'],
        },
      },
      snapshotReady: true,
    });
    expect(merged.public_booking).toBe(true);
  });

  it('disabled override forces false', () => {
    const features = extractSnapshotEffectiveFeatures({
      featureAccess: {
        features: { public_booking: true },
        disabledFeaturesOverride: ['public_booking'],
      },
    });
    expect(features.public_booking).toBe(false);
  });

  it('auth enabled override list enables public_booking before snapshot loads', () => {
    const merged = mergeEffectiveFeatures({
      fromAuth: { public_booking: false },
      snapshotReady: false,
      enabledFeaturesOverride: ['public_booking'],
    });
    expect(merged.public_booking).toBe(true);
  });
});
