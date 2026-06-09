import { describe, expect, it } from 'vitest';

import { mergeCatalogFeatureFlags } from './platform-plan-feature-flags.util';

describe('mergeCatalogFeatureFlags', () => {
  it('preserves explicit false from PATCH body', () => {
    const result = mergeCatalogFeatureFlags({ exports: true, analytics: true }, { exports: false });
    expect(result.exports).toBe(false);
    expect(result.analytics).toBe(true);
  });

  it('defaults missing catalog keys to false when not in existing', () => {
    const result = mergeCatalogFeatureFlags({}, { seat_management: true });
    expect(result.seat_management).toBe(true);
    expect(result.exports).toBe(false);
  });
});
