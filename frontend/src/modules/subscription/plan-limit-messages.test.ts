import { describe, expect, it } from 'vitest';

import { isAtCreateCap } from '@/modules/subscription/plan-limit-messages';

describe('isAtCreateCap', () => {
  it('blocks when used equals finite limit', () => {
    expect(isAtCreateCap({ used: 5, limit: 5, unlimited: false })).toBe(true);
  });

  it('allows when under limit', () => {
    expect(isAtCreateCap({ used: 4, limit: 5, unlimited: false })).toBe(false);
  });

  it('never blocks unlimited plans', () => {
    expect(isAtCreateCap({ used: 999, limit: null, unlimited: true })).toBe(false);
  });
});
