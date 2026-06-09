import type { AttendanceRecord } from './types';
import type { AttendanceBoardResponse, BoardAttendanceStatus, CheckOutSource } from './types-board';
import { isStudentCheckedIn } from './types-board';

export function resolveAttendanceStudentId(
  studentId: AttendanceRecord['studentId'],
): string {
  return typeof studentId === 'string' ? studentId : studentId._id;
}

function toBoardStatus(
  status: AttendanceRecord['status'],
  checkOutAt: string | null,
  checkOutSource?: CheckOutSource | null,
): BoardAttendanceStatus {
  if (checkOutAt) {
    if (checkOutSource === 'SYSTEM_AUTO') return 'CHECKED_OUT_AUTO';
    return 'CHECKED_OUT';
  }
  if (status === 'LATE') return 'LATE';
  if (status === 'CHECKED_IN' || status === 'PRESENT') return 'CHECKED_IN';
  return 'NOT_CHECKED_IN';
}

function isInside(status: BoardAttendanceStatus): boolean {
  return status === 'CHECKED_IN' || status === 'LATE';
}

function buildSummary(students: AttendanceBoardResponse['students']) {
  return {
    totalAssigned: students.length,
    checkedIn: students.filter((s) => s.attendanceStatus === 'CHECKED_IN').length,
    checkedOut: students.filter((s) => s.attendanceStatus === 'CHECKED_OUT').length,
    autoCheckedOut: students.filter((s) => s.attendanceStatus === 'CHECKED_OUT_AUTO').length,
    notCheckedIn: students.filter((s) => s.attendanceStatus === 'NOT_CHECKED_IN').length,
    late: students.filter((s) => s.attendanceStatus === 'LATE').length,
    absent: 0,
    activeInside: students.filter((s) => isInside(s.attendanceStatus)).length,
  };
}

export function patchBoardStudentAfterCheckIn(
  student: AttendanceBoardResponse['students'][0],
  attendance: AttendanceRecord,
): AttendanceBoardResponse['students'][0] {
  const studentId = resolveAttendanceStudentId(attendance.studentId);
  if (student.studentId !== studentId) return student;
  const nextStatus = toBoardStatus(attendance.status, attendance.checkOutAt);
  return {
    ...student,
    attendanceStatus: nextStatus,
    activeAttendanceId: attendance._id,
    activeCheckIn: true,
    checkOutSource: null,
    checkInAt: attendance.checkInAt,
    checkOutAt: null,
    durationMinutes: 0,
    attendanceId: attendance._id,
  };
}

export function patchBoardStudentAfterCheckOut(
  student: AttendanceBoardResponse['students'][0],
  attendance: AttendanceRecord,
): AttendanceBoardResponse['students'][0] {
  const studentId = resolveAttendanceStudentId(attendance.studentId);
  if (student.studentId !== studentId) return student;
  const checkOutSource = (attendance as AttendanceRecord & { checkOutSource?: CheckOutSource | null })
    .checkOutSource ?? 'MANUAL';
  const nextStatus = toBoardStatus(attendance.status, attendance.checkOutAt, checkOutSource);
  return {
    ...student,
    attendanceStatus: nextStatus,
    activeAttendanceId: null,
    activeCheckIn: false,
    checkOutSource,
    checkInAt: attendance.checkInAt,
    checkOutAt: attendance.checkOutAt,
    durationMinutes: attendance.durationMinutes,
    attendanceId: attendance._id,
  };
}

export function patchBoardAfterCheckIn(
  board: AttendanceBoardResponse | undefined,
  attendance: AttendanceRecord,
): AttendanceBoardResponse | undefined {
  if (!board) return board;

  const students = board.students.map((s) => patchBoardStudentAfterCheckIn(s, attendance));
  const studentId = resolveAttendanceStudentId(attendance.studentId);
  const nextStatus = toBoardStatus(attendance.status, attendance.checkOutAt);

  const grid = board.grid.map((cell) => {
    if (cell.student?.studentId !== studentId) return cell;
    return {
      ...cell,
      state: nextStatus === 'LATE' ? ('LATE' as const) : ('CHECKED_IN' as const),
      attendance: {
        attendanceStatus: nextStatus,
        activeAttendanceId: attendance._id,
        checkInAt: attendance.checkInAt,
        checkOutAt: null,
        durationMinutes: 0,
        checkOutSource: null,
      },
    };
  });

  return {
    ...board,
    students,
    grid,
    summary: buildSummary(students),
  };
}

export function patchBoardAfterCheckOut(
  board: AttendanceBoardResponse | undefined,
  attendance: AttendanceRecord,
): AttendanceBoardResponse | undefined {
  if (!board) return board;

  const students = board.students.map((s) => patchBoardStudentAfterCheckOut(s, attendance));
  const studentId = resolveAttendanceStudentId(attendance.studentId);
  const checkOutSource = (attendance as AttendanceRecord & { checkOutSource?: CheckOutSource | null })
    .checkOutSource ?? 'MANUAL';
  const nextStatus = toBoardStatus(attendance.status, attendance.checkOutAt, checkOutSource);

  const grid = board.grid.map((cell) => {
    if (cell.student?.studentId !== studentId) return cell;
    return {
      ...cell,
      state: 'CHECKED_OUT' as const,
      attendance: {
        attendanceStatus: nextStatus,
        activeAttendanceId: null,
        checkInAt: attendance.checkInAt,
        checkOutAt: attendance.checkOutAt,
        durationMinutes: attendance.durationMinutes,
        checkOutSource,
      },
    };
  });

  return {
    ...board,
    students,
    grid,
    summary: buildSummary(students),
  };
}

export { isStudentCheckedIn };
