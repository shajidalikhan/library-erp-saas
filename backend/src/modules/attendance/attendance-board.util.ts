import type { CheckOutSource } from './attendance.constants';
import type { BoardAttendanceStatus, BoardGridState } from './attendance-board.constants';
import type { AttendanceSessionLike, ShiftTimeLike } from './attendance-shift.util';
import { isPastShiftStartGrace } from './attendance-shift.util';

export type AttendanceRowLike = {
  checkInAt: Date | string | null;
  checkOutAt: Date | string | null;
  status: string;
  checkOutSource?: CheckOutSource | null;
  durationMinutes?: number;
  _id?: unknown;
} | null;

export function deriveBoardAttendanceStatus(row: AttendanceRowLike): BoardAttendanceStatus {
  if (!row?.checkInAt) {
    return 'NOT_CHECKED_IN';
  }
  if (row.checkOutAt) {
    if (row.checkOutSource === 'SYSTEM_AUTO') return 'CHECKED_OUT_AUTO';
    return 'CHECKED_OUT';
  }
  if (row.status === 'LATE') return 'LATE';
  return 'CHECKED_IN';
}

/** Open session id only when a real active check-in exists. */
export function resolveActiveAttendanceId(attendance: AttendanceRowLike): string | null {
  if (!attendance?.checkInAt || attendance.checkOutAt) return null;
  if (!attendance._id) return null;
  return String(attendance._id);
}

export function isOpenAttendanceSession(attendance: AttendanceRowLike): boolean {
  return Boolean(attendance?.checkInAt && !attendance.checkOutAt);
}

export function calcAttendanceDurationMinutes(
  checkInAt: Date | string | null | undefined,
  checkOutAt: Date | string | null | undefined,
): number {
  if (!checkInAt || !checkOutAt) return 0;
  const start = new Date(checkInAt);
  const end = new Date(checkOutAt);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

/** Board row times — never drop checkInAt after checkout. */
export function resolveBoardSessionTimes(params: {
  attendance: AttendanceRowLike;
  openSession: AttendanceRowLike;
  now?: Date;
}): {
  checkInAt: Date | null;
  checkOutAt: Date | null;
  durationMinutes: number;
} {
  const { attendance, openSession, now = new Date() } = params;

  if (isOpenAttendanceSession(openSession) && openSession?.checkInAt) {
    const checkInAt = new Date(openSession.checkInAt);
    return {
      checkInAt,
      checkOutAt: null,
      durationMinutes: calcAttendanceDurationMinutes(checkInAt, now),
    };
  }

  const checkInAt = attendance?.checkInAt ? new Date(attendance.checkInAt) : null;
  const checkOutAt = attendance?.checkOutAt ? new Date(attendance.checkOutAt) : null;
  const stored = attendance?.durationMinutes ?? 0;
  const durationMinutes =
    stored > 0
      ? stored
      : checkInAt && checkOutAt
        ? calcAttendanceDurationMinutes(checkInAt, checkOutAt)
        : 0;

  return { checkInAt, checkOutAt, durationMinutes };
}

/**
 * Pick the attendance record that drives board UI for a student.
 * Active open sessions take precedence on today's board (even from prior dates).
 */
export function resolveBoardStudentAttendance(params: {
  activeSession: AttendanceRowLike;
  daySession: AttendanceRowLike;
  boardDateKey: Date;
  todayDateKey: Date;
  checkInDateKey?: Date | null;
}): AttendanceRowLike {
  const { activeSession, daySession, boardDateKey, todayDateKey, checkInDateKey } = params;
  const isToday = boardDateKey.getTime() === todayDateKey.getTime();

  if (activeSession?.checkInAt && !activeSession.checkOutAt) {
    if (isToday) return activeSession;
    if (checkInDateKey && checkInDateKey.getTime() === boardDateKey.getTime()) {
      return activeSession;
    }
  }
  return daySession ?? null;
}

/**
 * Board attendance status is derived only from attendance records (never membership/seat).
 * CHECKED_IN / LATE require an open session with checkInAt and no checkOutAt.
 */
export function deriveBoardStatusForStudent(params: {
  attendance: AttendanceRowLike;
  activeOpenSession: AttendanceRowLike;
  shift?: ShiftTimeLike | null;
  now?: Date;
  boardDateKey?: Date;
  todayDateKey?: Date;
  lateGraceMinutes?: number;
}): BoardAttendanceStatus {
  void params.shift;
  void params.now;
  void params.boardDateKey;
  void params.todayDateKey;
  void params.lateGraceMinutes;

  if (isOpenAttendanceSession(params.activeOpenSession)) {
    return deriveBoardAttendanceStatus(params.activeOpenSession);
  }
  return deriveBoardAttendanceStatus(params.attendance);
}

export function deriveGridState(params: {
  hasAssignment: boolean;
  occupancyBlocked: boolean;
  attendance: AttendanceRowLike;
  /** Assigned but shift started — visual hint only, not checked-in. */
  lateWithoutCheckIn?: boolean;
}): BoardGridState {
  if (params.occupancyBlocked) return 'BLOCKED';
  if (!params.hasAssignment) return 'VACANT';
  const status = deriveBoardAttendanceStatus(params.attendance);
  if (status === 'NOT_CHECKED_IN') {
    return params.lateWithoutCheckIn ? 'LATE' : 'ASSIGNED_NOT_CHECKED_IN';
  }
  if (status === 'LATE') return 'LATE';
  if (status === 'CHECKED_IN') return 'CHECKED_IN';
  if (status === 'CHECKED_OUT' || status === 'CHECKED_OUT_AUTO') return 'CHECKED_OUT';
  return 'ABSENT';
}

export function isLateWithoutCheckIn(params: {
  attendance: AttendanceRowLike;
  activeOpenSession: AttendanceRowLike;
  shift: ShiftTimeLike | null | undefined;
  now: Date;
  boardDateKey: Date;
  todayDateKey: Date;
  lateGraceMinutes: number;
}): boolean {
  if (isOpenAttendanceSession(params.activeOpenSession)) return false;
  if (params.attendance?.checkInAt) return false;
  return isPastShiftStartGrace({
    now: params.now,
    boardDateKey: params.boardDateKey,
    todayDateKey: params.todayDateKey,
    shift: params.shift,
    graceMinutes: params.lateGraceMinutes,
  });
}

export function membershipStatusLabel(
  studentStatus: string,
  membershipEndDate: Date | string | null | undefined,
  now: Date,
): string {
  if (studentStatus === 'SUSPENDED') return 'SUSPENDED';
  if (studentStatus === 'INACTIVE') return 'INACTIVE';
  if (!membershipEndDate) return 'ACTIVE';
  const end = new Date(membershipEndDate);
  if (end < now) return 'EXPIRED';
  return 'ACTIVE';
}

export function matchesBoardFilter(
  status: BoardAttendanceStatus,
  filter: string | undefined,
): boolean {
  if (!filter || filter === 'all') return true;
  if (filter === 'checked_in') return status === 'CHECKED_IN' || status === 'LATE';
  if (filter === 'checked_out') return status === 'CHECKED_OUT';
  if (filter === 'auto_checked_out') return status === 'CHECKED_OUT_AUTO';
  if (filter === 'not_checked_in') return status === 'NOT_CHECKED_IN';
  if (filter === 'late') return status === 'LATE';
  return true;
}

export function isActiveBoardStatus(status: BoardAttendanceStatus): boolean {
  return status === 'CHECKED_IN' || status === 'LATE';
}
