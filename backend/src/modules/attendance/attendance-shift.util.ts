import type { CheckOutSource } from './attendance.constants';

export type ShiftTimeLike = { startTime: string; endTime: string };

export type AttendanceSessionLike = {
  checkInAt: Date | string | null;
  checkOutAt: Date | string | null;
  status?: string;
  checkOutSource?: CheckOutSource | null;
  date?: Date | string;
} | null;

/** Parse HH:mm against a calendar day in UTC (date key at 00:00 UTC). */
export function parseTimeOnDateKey(timeStr: string, dateKey: Date): Date {
  const [hh, mm] = timeStr.split(':').map((v) => Number(v));
  const d = new Date(dateKey);
  d.setUTCHours(Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d;
}

/** End-of-day fallback (23:59) on the given date key. */
export function endOfDayOnDateKey(dateKey: Date): Date {
  const d = new Date(dateKey);
  d.setUTCHours(23, 59, 0, 0);
  return d;
}

/**
 * Resolve when a session should end for auto-checkout.
 * Uses shift end when assigned; otherwise end of check-in day.
 */
export function resolveExpectedSessionEnd(params: {
  checkInAt: Date;
  sessionDateKey: Date;
  shift: ShiftTimeLike | null | undefined;
}): Date {
  const { checkInAt, sessionDateKey, shift } = params;
  if (shift?.endTime) {
    let end = parseTimeOnDateKey(shift.endTime, sessionDateKey);
    // Overnight shift: end time earlier than start → next calendar day
    if (shift.startTime && shift.endTime <= shift.startTime) {
      end = new Date(end);
      end.setUTCDate(end.getUTCDate() + 1);
    }
    // If check-in happened after nominal end (overnight), anchor to check-in day
    if (end < checkInAt) {
      end = parseTimeOnDateKey(shift.endTime, sessionDateKey);
      end.setUTCDate(end.getUTCDate() + 1);
    }
    return end;
  }
  return endOfDayOnDateKey(sessionDateKey);
}

/** True when check-in occurs after shift start + grace minutes. */
export function isCheckInLate(params: {
  checkInAt: Date;
  sessionDateKey: Date;
  shift: ShiftTimeLike | null | undefined;
  graceMinutes: number;
}): boolean {
  const { checkInAt, sessionDateKey, shift, graceMinutes } = params;
  if (!shift?.startTime) {
    return checkInAt.getUTCHours() >= 10;
  }
  const shiftStart = parseTimeOnDateKey(shift.startTime, sessionDateKey);
  const deadline = new Date(shiftStart.getTime() + graceMinutes * 60_000);
  return checkInAt > deadline;
}

/** True when now is past shift start + grace and student has not checked in. */
export function isPastShiftStartGrace(params: {
  now: Date;
  boardDateKey: Date;
  todayDateKey: Date;
  shift: ShiftTimeLike | null | undefined;
  graceMinutes: number;
}): boolean {
  const { now, boardDateKey, todayDateKey, shift, graceMinutes } = params;
  if (boardDateKey.getTime() !== todayDateKey.getTime()) return false;
  if (!shift?.startTime) return false;
  const shiftStart = parseTimeOnDateKey(shift.startTime, boardDateKey);
  const deadline = new Date(shiftStart.getTime() + graceMinutes * 60_000);
  return now > deadline;
}

/** Whether an open session should be auto-checked out at `now`. */
export function shouldAutoCheckoutSession(params: {
  checkInAt: Date;
  sessionDateKey: Date;
  shift: ShiftTimeLike | null | undefined;
  graceMinutes: number;
  now: Date;
}): boolean {
  const expectedEnd = resolveExpectedSessionEnd({
    checkInAt: params.checkInAt,
    sessionDateKey: params.sessionDateKey,
    shift: params.shift,
  });
  const deadline = new Date(expectedEnd.getTime() + params.graceMinutes * 60_000);
  return params.now >= deadline;
}
