import { describe, expect, it } from 'vitest';

import { SUBSCRIPTION_FEATURE_CATALOG } from '@/modules/subscription/subscription-feature-catalog';
import { FEATURE_UPGRADE_TOOLTIPS } from '@/modules/subscription/plan-limit-messages';

describe('subscription feature catalog (frontend)', () => {
  it('defines all required feature keys', () => {
    const keys = SUBSCRIPTION_FEATURE_CATALOG.map((f) => f.key);
    expect(keys).toContain('multi_branch');
    expect(keys).toContain('analytics');
    expect(keys).toContain('exports');
    expect(keys).toContain('reports');
    expect(keys).toContain('qr_attendance');
  });

  it('upgrade messages avoid raw technical keys', () => {
    expect(FEATURE_UPGRADE_TOOLTIPS.exports).not.toContain('exports');
    expect(FEATURE_UPGRADE_TOOLTIPS.exports.toLowerCase()).toContain('upgrade');
  });
});
