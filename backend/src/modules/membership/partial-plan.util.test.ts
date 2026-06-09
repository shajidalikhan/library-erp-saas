import { describe, expect, it } from 'vitest';

import {
  getMinimumStartAmount,
  resolvePartialPlanConfig,
  validatePartialPaymentAmount,
} from './partial-plan.util';

describe('partial-plan.util', () => {
  const sixMonthPlan = {
    amount: 11000,
    durationDays: 180,
    billingDurationMonths: 6,
    allowPartialStart: true,
    minimumStartAmountType: 'ONE_MONTH' as const,
    minimumStartAmount: 2200,
    partialDueDays: 7,
    downgradeIfUnpaid: true,
    downgradeDurationDays: 30,
  };

  it('computes ONE_MONTH minimum from explicit amount', () => {
    const config = resolvePartialPlanConfig(sixMonthPlan);
    expect(getMinimumStartAmount(sixMonthPlan, 11000, config)).toBe(2200);
  });

  it('requires full amount when partial start disabled', () => {
    const err = validatePartialPaymentAmount({
      allowPartialStart: false,
      minimumStartAmount: 2200,
      paidAmount: 1000,
      invoiceTotal: 11000,
    });
    expect(err).toContain('Full plan amount');
  });

  it('requires minimum when partial start enabled', () => {
    const err = validatePartialPaymentAmount({
      allowPartialStart: true,
      minimumStartAmount: 2200,
      paidAmount: 500,
      invoiceTotal: 11000,
    });
    expect(err).toContain('Minimum payment required');
  });

  it('allows zero payment (invoice unpaid)', () => {
    const err = validatePartialPaymentAmount({
      allowPartialStart: true,
      minimumStartAmount: 2200,
      paidAmount: 0,
      invoiceTotal: 11000,
    });
    expect(err).toBeNull();
  });

  it('allows payment equal to minimum', () => {
    const err = validatePartialPaymentAmount({
      allowPartialStart: true,
      minimumStartAmount: 2200,
      paidAmount: 2200,
      invoiceTotal: 11000,
    });
    expect(err).toBeNull();
  });
});
