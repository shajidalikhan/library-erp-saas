import { describe, expect, it } from 'vitest';

import {
  deriveBoardAttendanceStatus,
  deriveBoardStatusForStudent,
  matchesBoardFilter,
  resolveBoardSessionTimes,
  resolveBoardStudentAttendance,
} from './attendance-board.util';
import { shouldAutoCheckoutSession } from './attendance-shift.util';

describe('resolveBoardStudentAttendance', () => {
  const boardDate = new Date('2026-05-31T00:00:00.000Z');
  const todayDate = new Date('2026-05-31T00:00:00.000Z');
  const yesterdayDate = new Date('2026-05-30T00:00:00.000Z');

  it('uses active session on today board even when day record is missing', () => {
    const active = {
      checkInAt: new Date('2026-05-30T22:00:00.000Z'),
      checkOutAt: null,
      status: 'CHECKED_IN',
    };
    const resolved = resolveBoardStudentAttendance({
      activeSession: active,
      daySession: null,
      boardDateKey: boardDate,
      todayDateKey: todayDate,
      checkInDateKey: yesterdayDate,
    });
    expect(resolved).toBe(active);
    expect(deriveBoardAttendanceStatus(resolved)).toBe('CHECKED_IN');
  });

  it('shows CHECKED_IN when active session exists', () => {
    const active = {
      checkInAt: new Date('2026-05-31T08:00:00.000Z'),
      checkOutAt: null,
      status: 'CHECKED_IN',
    };
    expect(deriveBoardAttendanceStatus(active)).toBe('CHECKED_IN');
  });

  it('falls back to day session when no active session', () => {
    const day = {
      checkInAt: new Date('2026-05-31T08:00:00.000Z'),
      checkOutAt: new Date('2026-05-31T18:00:00.000Z'),
      status: 'CHECKED_OUT',
      checkOutSource: 'MANUAL' as const,
    };
    const resolved = resolveBoardStudentAttendance({
      activeSession: null,
      daySession: day,
      boardDateKey: boardDate,
      todayDateKey: todayDate,
      checkInDateKey: null,
    });
    expect(resolved).toBe(day);
    expect(deriveBoardAttendanceStatus(resolved)).toBe('CHECKED_OUT');
  });

  it('shows CHECKED_OUT_AUTO for system auto checkout', () => {
    expect(
      deriveBoardAttendanceStatus({
        checkInAt: new Date('2026-05-31T08:00:00.000Z'),
        checkOutAt: new Date('2026-05-31T22:30:00.000Z'),
        status: 'CHECKED_OUT',
        checkOutSource: 'SYSTEM_AUTO',
      }),
    ).toBe('CHECKED_OUT_AUTO');
  });

  it('filters auto checked out rows', () => {
    expect(matchesBoardFilter('CHECKED_OUT_AUTO', 'auto_checked_out')).toBe(true);
    expect(matchesBoardFilter('CHECKED_OUT', 'auto_checked_out')).toBe(false);
  });
});

describe('shouldAutoCheckoutSession', () => {
  it('auto checkout closes expired session after shift end + grace', () => {
    const sessionDateKey = new Date('2026-05-31T00:00:00.000Z');
    const checkInAt = new Date('2026-05-31T08:00:00.000Z');
    const now = new Date('2026-05-31T18:35:00.000Z');
    expect(
      shouldAutoCheckoutSession({
        checkInAt,
        sessionDateKey,
        shift: { startTime: '08:00', endTime: '18:00' },
        graceMinutes: 30,
        now,
      }),
    ).toBe(true);
  });

  it('does not auto checkout before grace deadline', () => {
    const sessionDateKey = new Date('2026-05-31T00:00:00.000Z');
    const checkInAt = new Date('2026-05-31T08:00:00.000Z');
    const now = new Date('2026-05-31T18:15:00.000Z');
    expect(
      shouldAutoCheckoutSession({
        checkInAt,
        sessionDateKey,
        shift: { startTime: '08:00', endTime: '18:00' },
        graceMinutes: 30,
        now,
      }),
    ).toBe(false);
  });

  it('uses end of day when no shift assigned', () => {
    const sessionDateKey = new Date('2026-05-31T00:00:00.000Z');
    const checkInAt = new Date('2026-05-31T20:00:00.000Z');
    const now = new Date('2026-06-01T00:35:00.000Z');
    expect(
      shouldAutoCheckoutSession({
        checkInAt,
        sessionDateKey,
        shift: null,
        graceMinutes: 30,
        now,
      }),
    ).toBe(true);
  });
});

describe('deriveBoardStatusForStudent', () => {
  it('new student with seat assignment stays NOT_CHECKED_IN after shift grace', () => {
    const boardDateKey = new Date('2026-05-31T00:00:00.000Z');
    const now = new Date('2026-05-31T09:30:00.000Z');
    const status = deriveBoardStatusForStudent({
      attendance: null,
      activeOpenSession: null,
      shift: { startTime: '08:00', endTime: '18:00' },
      now,
      boardDateKey,
      todayDateKey: boardDateKey,
      lateGraceMinutes: 15,
    });
    expect(status).toBe('NOT_CHECKED_IN');
  });

  it('shows CHECKED_IN only when an open attendance session exists', () => {
    const open = {
      _id: 'att-1',
      checkInAt: new Date('2026-05-31T08:05:00.000Z'),
      checkOutAt: null,
      status: 'CHECKED_IN',
    };
    expect(
      deriveBoardStatusForStudent({
        attendance: null,
        activeOpenSession: open,
      }),
    ).toBe('CHECKED_IN');
  });

  it('active membership without attendance stays NOT_CHECKED_IN', () => {
    expect(
      deriveBoardStatusForStudent({
        attendance: null,
        activeOpenSession: null,
      }),
    ).toBe('NOT_CHECKED_IN');
  });
});

describe('resolveBoardSessionTimes after auto checkout', () => {
  it('preserves checkInAt and duration for SYSTEM_AUTO checkout', () => {
    const checkInAt = new Date('2026-05-31T08:00:00.000Z');
    const checkOutAt = new Date('2026-05-31T18:30:00.000Z');
    const times = resolveBoardSessionTimes({
      attendance: {
        _id: 'auto-1',
        checkInAt,
        checkOutAt,
        durationMinutes: 630,
        status: 'CHECKED_OUT',
        checkOutSource: 'SYSTEM_AUTO',
      },
      openSession: null,
    });
    expect(times.checkInAt).toEqual(checkInAt);
    expect(times.checkOutAt).toEqual(checkOutAt);
    expect(times.durationMinutes).toBe(630);
    expect(
      deriveBoardAttendanceStatus({
        checkInAt,
        checkOutAt,
        status: 'CHECKED_OUT',
        checkOutSource: 'SYSTEM_AUTO',
      }),
    ).toBe('CHECKED_OUT_AUTO');
  });
});
