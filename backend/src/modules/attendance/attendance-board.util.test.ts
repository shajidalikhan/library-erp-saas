import { describe, expect, it } from 'vitest';

import {
  deriveBoardAttendanceStatus,
  deriveGridState,
  isLateWithoutCheckIn,
  isOpenAttendanceSession,
  matchesBoardFilter,
  membershipStatusLabel,
  calcAttendanceDurationMinutes,
  resolveActiveAttendanceId,
  resolveBoardSessionTimes,
} from './attendance-board.util';

describe('attendance-board.util', () => {
  it('derives NOT_CHECKED_IN without record', () => {
    expect(deriveBoardAttendanceStatus(null)).toBe('NOT_CHECKED_IN');
  });

  it('derives CHECKED_IN for open session', () => {
    expect(
      deriveBoardAttendanceStatus({
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'CHECKED_IN',
      }),
    ).toBe('CHECKED_IN');
  });

  it('derives LATE for open late session', () => {
    expect(
      deriveBoardAttendanceStatus({
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'LATE',
      }),
    ).toBe('LATE');
  });

  it('derives CHECKED_OUT when checked out manually', () => {
    expect(
      deriveBoardAttendanceStatus({
        checkInAt: new Date(),
        checkOutAt: new Date(),
        status: 'CHECKED_OUT',
        checkOutSource: 'MANUAL',
      }),
    ).toBe('CHECKED_OUT');
  });

  it('derives CHECKED_OUT_AUTO for system checkout', () => {
    expect(
      deriveBoardAttendanceStatus({
        checkInAt: new Date(),
        checkOutAt: new Date(),
        status: 'CHECKED_OUT',
        checkOutSource: 'SYSTEM_AUTO',
      }),
    ).toBe('CHECKED_OUT_AUTO');
  });

  it('maps grid vacant without assignment', () => {
    expect(
      deriveGridState({ hasAssignment: false, occupancyBlocked: false, attendance: null }),
    ).toBe('VACANT');
  });

  it('maps grid blocked', () => {
    expect(
      deriveGridState({ hasAssignment: true, occupancyBlocked: true, attendance: null }),
    ).toBe('BLOCKED');
  });

  it('maps assigned not checked in', () => {
    expect(
      deriveGridState({ hasAssignment: true, occupancyBlocked: false, attendance: null }),
    ).toBe('ASSIGNED_NOT_CHECKED_IN');
  });

  it('filters checked_in includes late', () => {
    expect(matchesBoardFilter('LATE', 'checked_in')).toBe(true);
    expect(matchesBoardFilter('NOT_CHECKED_IN', 'checked_in')).toBe(false);
  });

  it('filters auto_checked_out', () => {
    expect(matchesBoardFilter('CHECKED_OUT_AUTO', 'auto_checked_out')).toBe(true);
  });

  it('labels expired membership', () => {
    const label = membershipStatusLabel('ACTIVE', '2020-01-01', new Date('2026-05-19'));
    expect(label).toBe('EXPIRED');
  });

  it('resolveActiveAttendanceId returns id only for open sessions', () => {
    expect(resolveActiveAttendanceId(null)).toBeNull();
    expect(
      resolveActiveAttendanceId({
        _id: 'a1',
        checkInAt: new Date(),
        checkOutAt: new Date(),
        status: 'CHECKED_OUT',
      }),
    ).toBeNull();
    expect(
      resolveActiveAttendanceId({
        _id: 'a2',
        checkInAt: new Date(),
        checkOutAt: null,
        status: 'CHECKED_IN',
      }),
    ).toBe('a2');
  });

  it('isOpenAttendanceSession requires checkInAt and no checkOutAt', () => {
    expect(isOpenAttendanceSession(null)).toBe(false);
    expect(
      isOpenAttendanceSession({ checkInAt: new Date(), checkOutAt: null, status: 'CHECKED_IN' }),
    ).toBe(true);
    expect(
      isOpenAttendanceSession({ checkInAt: new Date(), checkOutAt: new Date(), status: 'CHECKED_OUT' }),
    ).toBe(false);
  });

  it('grid lateWithoutCheckIn is visual only — not checked in', () => {
    expect(
      deriveGridState({
        hasAssignment: true,
        occupancyBlocked: false,
        attendance: null,
        lateWithoutCheckIn: true,
      }),
    ).toBe('LATE');
    expect(
      deriveGridState({
        hasAssignment: true,
        occupancyBlocked: false,
        attendance: null,
        lateWithoutCheckIn: false,
      }),
    ).toBe('ASSIGNED_NOT_CHECKED_IN');
  });

  it('calcAttendanceDurationMinutes matches checkout example', () => {
    const checkInAt = new Date('2026-05-31T10:17:00.000Z');
    const checkOutAt = new Date('2026-05-31T12:45:00.000Z');
    expect(calcAttendanceDurationMinutes(checkInAt, checkOutAt)).toBe(148);
  });

  it('resolveBoardSessionTimes preserves checkInAt after checkout', () => {
    const checkInAt = new Date('2026-05-31T10:17:00.000Z');
    const checkOutAt = new Date('2026-05-31T12:45:00.000Z');
    const attendance = {
      _id: 'att-1',
      checkInAt,
      checkOutAt,
      durationMinutes: 148,
      status: 'CHECKED_OUT',
      checkOutSource: 'MANUAL' as const,
    };
    const times = resolveBoardSessionTimes({ attendance, openSession: null });
    expect(times.checkInAt).toEqual(checkInAt);
    expect(times.checkOutAt).toEqual(checkOutAt);
    expect(times.durationMinutes).toBe(148);
  });

  it('resolveBoardSessionTimes computes live duration for open session', () => {
    const checkInAt = new Date('2026-05-31T10:00:00.000Z');
    const now = new Date('2026-05-31T11:30:00.000Z');
    const openSession = {
      _id: 'att-2',
      checkInAt,
      checkOutAt: null,
      status: 'CHECKED_IN',
    };
    const times = resolveBoardSessionTimes({ attendance: null, openSession, now });
    expect(times.checkInAt).toEqual(checkInAt);
    expect(times.checkOutAt).toBeNull();
    expect(times.durationMinutes).toBe(90);
  });

  it('resolveBoardSessionTimes recalculates duration when stored value missing', () => {
    const checkInAt = new Date('2026-05-31T10:17:00.000Z');
    const checkOutAt = new Date('2026-05-31T12:45:00.000Z');
    const times = resolveBoardSessionTimes({
      attendance: {
        checkInAt,
        checkOutAt,
        durationMinutes: 0,
        status: 'CHECKED_OUT',
      },
      openSession: null,
    });
    expect(times.durationMinutes).toBe(148);
  });

  it('resolveBoardSessionTimes handles legacy checkout without checkInAt', () => {
    const times = resolveBoardSessionTimes({
      attendance: {
        checkInAt: null,
        checkOutAt: new Date('2026-05-31T12:45:00.000Z'),
        durationMinutes: 0,
        status: 'CHECKED_OUT',
      },
      openSession: null,
    });
    expect(times.checkInAt).toBeNull();
    expect(times.checkOutAt).not.toBeNull();
    expect(times.durationMinutes).toBe(0);
  });

  it('isLateWithoutCheckIn when past grace without attendance', () => {
    const boardDateKey = new Date('2026-05-31T00:00:00.000Z');
    expect(
      isLateWithoutCheckIn({
        attendance: null,
        activeOpenSession: null,
        shift: { startTime: '08:00', endTime: '18:00' },
        now: new Date('2026-05-31T09:30:00.000Z'),
        boardDateKey,
        todayDateKey: boardDateKey,
        lateGraceMinutes: 15,
      }),
    ).toBe(true);
  });
});
