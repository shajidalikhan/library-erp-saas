import { describe, expect, it } from 'vitest';

import { resolveActiveBookingStep } from './public-booking-steps';

describe('resolveActiveBookingStep', () => {
  it('walks through branch → shift → plan → seat → details', () => {
    expect(
      resolveActiveBookingStep({
        branchId: '',
        shiftId: '',
        feePlanId: '',
        seatId: '',
        hasSubmitted: false,
      }),
    ).toBe('branch');
    expect(
      resolveActiveBookingStep({
        branchId: 'b1',
        shiftId: '',
        feePlanId: '',
        seatId: '',
        hasSubmitted: false,
      }),
    ).toBe('shift');
    expect(
      resolveActiveBookingStep({
        branchId: 'b1',
        shiftId: 's1',
        feePlanId: '',
        seatId: '',
        hasSubmitted: false,
      }),
    ).toBe('plan');
    expect(
      resolveActiveBookingStep({
        branchId: 'b1',
        shiftId: 's1',
        feePlanId: 'p1',
        seatId: '',
        hasSubmitted: false,
      }),
    ).toBe('seat');
    expect(
      resolveActiveBookingStep({
        branchId: 'b1',
        shiftId: 's1',
        feePlanId: 'p1',
        seatId: 'seat1',
        hasSubmitted: false,
      }),
    ).toBe('details');
  });
});
