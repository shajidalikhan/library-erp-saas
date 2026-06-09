import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';

import {
  cellBlockedReason,
  intervalsOverlap,
  isFullDayShift,
  shiftsTimeOverlap,
  shiftToIntervals,
} from './seat-occupancy.conflicts';

describe('seat-occupancy.conflicts', () => {
  it('detects same-day overlap', () => {
    expect(
      shiftsTimeOverlap({ startTime: '06:00', endTime: '12:00' }, { startTime: '11:00', endTime: '16:00' }),
    ).toBe(true);
  });

  it('allows non-overlapping morning and evening', () => {
    expect(
      shiftsTimeOverlap({ startTime: '06:00', endTime: '12:00' }, { startTime: '17:00', endTime: '22:00' }),
    ).toBe(false);
  });

  it('full day blocks another shift on same seat', () => {
    const fullDay = {
      _id: new Types.ObjectId(),
      type: 'FULL_DAY',
      startTime: '06:00',
      endTime: '22:00',
    };
    const morning = {
      _id: new Types.ObjectId(),
      type: 'MORNING',
      startTime: '06:00',
      endTime: '12:00',
    };
    expect(
      cellBlockedReason(morning, [{ shiftId: fullDay }]),
    ).toMatch(/full-day/i);
  });

  it('overnight shift splits into two intervals', () => {
    const intervals = shiftToIntervals('22:00', '06:00');
    expect(intervals).toHaveLength(2);
    expect(intervalsOverlap(intervals, shiftToIntervals('23:00', '23:30'))).toBe(true);
  });

  it('identifies full day kind', () => {
    expect(isFullDayShift({ type: 'FULL_DAY' })).toBe(true);
    expect(isFullDayShift({ type: 'MORNING' })).toBe(false);
  });
});
