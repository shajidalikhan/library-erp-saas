import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { canUseFeature, subscriptionFeatureErrorMessage } from '@/lib/feature-access';

describe('canUseFeature', () => {
  it('blocks when feature missing on plan', () => {
    const r = canUseFeature({ notifications: false }, 'notifications', true, 'Basic');
    expect(r.allowed).toBe(false);
    expect(r.upgradeRequired).toBe(true);
    expect(r.reason).toContain('subscription plan');
  });

  it('allows when feature enabled', () => {
    const r = canUseFeature({ notifications: true }, 'notifications', true);
    expect(r.allowed).toBe(true);
  });
});

describe('subscriptionFeatureErrorMessage', () => {
  it('maps forbidden subscription errors', () => {
    const err = new ApiError({
      message: 'Your current subscription plan does not include this feature.',
      statusCode: 403,
      code: 'FORBIDDEN',
      details: { upgradeRequired: true },
    });
    expect(subscriptionFeatureErrorMessage(err)).toContain('subscription plan');
  });
});
