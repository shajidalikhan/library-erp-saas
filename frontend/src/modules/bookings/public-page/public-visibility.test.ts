import { describe, expect, it } from 'vitest';

import {
  filterPublicSummaryForDisplay,
  getPublicSeatTooltip,
  isPublicSeatSelectable,
  plansForShift,
  showFullSeatBreakdown,
} from './public-visibility';

describe('public visibility', () => {
  it('defaults to hiding full seat breakdown', () => {
    expect(showFullSeatBreakdown({})).toBe(false);
    expect(showFullSeatBreakdown({ publicBookingSettings: { showFullSeatBreakdown: false } })).toBe(
      false,
    );
  });

  it('shows only available count when breakdown is disabled', () => {
    const rows = filterPublicSummaryForDisplay(
      { AVAILABLE: 83, OCCUPIED: 10, RESERVED: 2, BLOCKED: 5 },
      false,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(83);
    expect(rows[0].label).toContain('Available');
  });

  it('shows full breakdown when enabled', () => {
    const rows = filterPublicSummaryForDisplay(
      { AVAILABLE: 10, OCCUPIED: 5, RESERVED: 2, BLOCKED: 3 },
      true,
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.key)).toEqual(['AVAILABLE', 'OCCUPIED', 'RESERVED_BLOCKED']);
  });

  it('masks unavailable seat reasons when breakdown is off', () => {
    expect(getPublicSeatTooltip('OCCUPIED', false)).toBe('Not available');
    expect(getPublicSeatTooltip('NOT_AVAILABLE', false)).toBe('Not available');
    expect(isPublicSeatSelectable('NOT_AVAILABLE')).toBe(false);
    expect(isPublicSeatSelectable('AVAILABLE')).toBe(true);
  });

  it('filters plans for a selected shift', () => {
    const profile = {
      feePlans: [
        { _id: 'p1', branchId: 'b1', shiftId: 's1', name: 'A', type: 'MEMBERSHIP', amount: 100, durationDays: 30 },
        { _id: 'p2', branchId: 'b1', shiftId: null, name: 'B', type: 'MEMBERSHIP', amount: 200, durationDays: 30 },
        { _id: 'p3', branchId: 'b2', shiftId: 's1', name: 'C', type: 'MEMBERSHIP', amount: 300, durationDays: 30 },
      ],
    } as Parameters<typeof plansForShift>[0];
    const plans = plansForShift(profile, 's1', 'b1');
    expect(plans.map((p) => p._id)).toEqual(['p1', 'p2']);
  });
});
