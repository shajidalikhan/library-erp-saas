export type BoardAttendanceStatus =
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CHECKED_OUT_AUTO'
  | 'NOT_CHECKED_IN'
  | 'LATE';

export type CheckOutSource = 'MANUAL' | 'QR' | 'SYSTEM_AUTO';

export type BoardGridState =
  | 'VACANT'
  | 'ASSIGNED_NOT_CHECKED_IN'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'LATE'
  | 'ABSENT'
  | 'BLOCKED';

export type AttendanceBoardStudent = {
  studentId: string;
  studentName: string;
  studentCode: string;
  phone: string | null;
  photoUrl: string | null;
  seatNumber: string | null;
  seatId: string | null;
  shiftName: string | null;
  shiftId: string | null;
  membershipStatus: string;
  membershipEndDate: string | null;
  attendanceStatus: BoardAttendanceStatus;
  activeAttendanceId: string | null;
  activeCheckIn: boolean;
  checkOutSource: CheckOutSource | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationMinutes: number;
  dueAmount: number;
  attendanceId: string | null;
};

export type AttendanceBoardGridCell = {
  seatId: string;
  seatNumber: string;
  shiftId: string;
  shiftName: string;
  shiftTime: string;
  state: BoardGridState;
  student: {
    studentId: string;
    studentName: string;
    studentCode: string;
    phone: string | null;
    membershipEndDate: string | null;
  } | null;
  attendance: {
    attendanceStatus: BoardAttendanceStatus;
    activeAttendanceId?: string | null;
    checkInAt: string | null;
    checkOutAt: string | null;
    durationMinutes: number;
    checkOutSource: CheckOutSource | null;
  } | null;
};

export type AttendanceBoardResponse = {
  branch: { _id: string; branchName: string; branchCode?: string };
  date: string;
  shifts: Array<{
    _id: string;
    name: string;
    startTime: string;
    endTime: string;
    type: string;
    color?: string;
  }>;
  seats: Array<{ _id: string; seatNumber: string; floor: string; zone: string }>;
  students: AttendanceBoardStudent[];
  grid: AttendanceBoardGridCell[];
  summary: {
    totalAssigned: number;
    checkedIn: number;
    checkedOut: number;
    autoCheckedOut: number;
    notCheckedIn: number;
    late: number;
    absent: number;
    activeInside: number;
  };
};

export type AttendanceBoardParams = {
  libraryId?: string;
  branchId?: string;
  date?: string;
  shiftId?: string;
  mode?: 'students' | 'grid';
};

export const STUDENT_COLUMN_KEYS = [
  'photo',
  'name',
  'code',
  'phone',
  'seat',
  'shift',
  'membership',
  'status',
  'checkIn',
  'checkOut',
  'duration',
  'actions',
] as const;

export type StudentColumnKey = (typeof STUDENT_COLUMN_KEYS)[number];

export const DEFAULT_STUDENT_COLUMNS: StudentColumnKey[] = [
  'photo',
  'name',
  'code',
  'phone',
  'seat',
  'shift',
  'membership',
  'status',
  'checkIn',
  'checkOut',
  'duration',
  'actions',
];

export function isStudentCheckedIn(student: AttendanceBoardStudent): boolean {
  const activeId = student.activeAttendanceId ?? null;
  if (!activeId) return false;
  return student.attendanceStatus === 'CHECKED_IN' || student.attendanceStatus === 'LATE';
}

export function isStudentCheckedOut(student: AttendanceBoardStudent): boolean {
  return student.attendanceStatus === 'CHECKED_OUT' || student.attendanceStatus === 'CHECKED_OUT_AUTO';
}
