import { describe, expect, it } from 'vitest';

import {
  formatBoardCheckInTime,
  formatBoardCheckOutTime,
  formatBoardDuration,
  formatDuration,
} from './format-duration.util';

describe('formatDuration', () => {
  it('formats zero and sub-hour durations', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(35)).toBe('35m');
  });

  it('formats hour and mixed durations', () => {
    expect(formatDuration(75)).toBe('1h 15m');
    expect(formatDuration(148)).toBe('2h 28m');
    expect(formatDuration(120)).toBe('2h');
  });
});

describe('formatBoardDuration', () => {
  it('shows Active for checked-in student', () => {
    expect(
      formatBoardDuration({
        attendanceStatus: 'CHECKED_IN',
        activeAttendanceId: 'att-1',
        checkInAt: '2026-05-31T10:00:00.000Z',
        checkOutAt: null,
        durationMinutes: 45,
      }),
    ).toBe('Active');
  });

  it('shows formatted duration after checkout', () => {
    expect(
      formatBoardDuration({
        attendanceStatus: 'CHECKED_OUT',
        activeAttendanceId: null,
        checkInAt: '2026-05-31T10:17:00.000Z',
        checkOutAt: '2026-05-31T12:45:00.000Z',
        durationMinutes: 148,
      }),
    ).toBe('2h 28m');
  });

  it('shows dash when not checked in', () => {
    expect(
      formatBoardDuration({
        attendanceStatus: 'NOT_CHECKED_IN',
        activeAttendanceId: null,
        checkInAt: null,
        checkOutAt: null,
        durationMinutes: 0,
      }),
    ).toBe('—');
  });

  it('handles legacy record with checkout but missing check-in', () => {
    expect(
      formatBoardDuration({
        attendanceStatus: 'CHECKED_OUT',
        activeAttendanceId: null,
        checkInAt: null,
        checkOutAt: '2026-05-31T12:45:00.000Z',
        durationMinutes: 0,
      }),
    ).toBe('—');
  });
});

describe('formatBoardCheckOutTime', () => {
  it('shows dash while checked in', () => {
    expect(
      formatBoardCheckOutTime({
        attendanceStatus: 'CHECKED_IN',
        checkOutAt: null,
        activeAttendanceId: 'a1',
      } as never),
    ).toBe('—');
  });

  it('shows checkout time after checkout', () => {
    const t = formatBoardCheckOutTime({
      attendanceStatus: 'CHECKED_OUT',
      checkOutAt: '2026-05-31T17:45:00.000Z',
      activeAttendanceId: null,
    } as never);
    expect(t).not.toBe('—');
    expect(formatBoardCheckInTime('2026-05-31T17:45:00.000Z')).toBe(t);
  });
});
