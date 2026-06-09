import type { AttendanceBoardStudent } from './types-board';
import { isStudentCheckedIn } from './types-board';

/** Format minutes as human-readable duration (e.g. 148 → "2h 28m"). */
export function formatDuration(minutes: number | null | undefined): string {
  const mins = Math.max(0, Math.floor(minutes ?? 0));
  if (mins === 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatBoardCheckInTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatBoardCheckOutTime(
  student: Pick<AttendanceBoardStudent, 'attendanceStatus' | 'checkOutAt' | 'activeAttendanceId'>,
): string {
  if (isStudentCheckedIn(student as AttendanceBoardStudent)) return '—';
  if (!student.checkOutAt) return '—';
  return formatBoardCheckInTime(student.checkOutAt);
}

export function formatBoardDuration(
  student: Pick<
    AttendanceBoardStudent,
    'attendanceStatus' | 'activeAttendanceId' | 'checkInAt' | 'checkOutAt' | 'durationMinutes'
  >,
): string {
  if (isStudentCheckedIn(student as AttendanceBoardStudent)) return 'Active';
  if (student.attendanceStatus === 'NOT_CHECKED_IN') return '—';
  if (student.checkOutAt) {
    if (!student.checkInAt) return '—';
    return formatDuration(student.durationMinutes);
  }
  return '—';
}
