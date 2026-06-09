import { describe, expect, it } from 'vitest';

import type { AttendanceBoardStudent } from './types-board';
import { isStudentCheckedIn } from './types-board';

function student(overrides: Partial<AttendanceBoardStudent> = {}): AttendanceBoardStudent {
  return {
    studentId: 's1',
    studentName: 'Test',
    studentCode: 'ST001',
    phone: null,
    photoUrl: null,
    seatNumber: 'A1',
    seatId: 'seat-1',
    shiftName: 'Morning',
    shiftId: 'shift-1',
    membershipStatus: 'ACTIVE',
    membershipEndDate: null,
    attendanceStatus: 'NOT_CHECKED_IN',
    activeAttendanceId: null,
    activeCheckIn: false,
    checkOutSource: null,
    checkInAt: null,
    checkOutAt: null,
    durationMinutes: 0,
    dueAmount: 0,
    attendanceId: null,
    ...overrides,
  };
}

describe('isStudentCheckedIn', () => {
  it('new student with seat and membership is not checked in', () => {
    expect(isStudentCheckedIn(student())).toBe(false);
  });

  it('LATE status without activeAttendanceId is not checked in', () => {
    expect(
      isStudentCheckedIn(
        student({ attendanceStatus: 'LATE', activeCheckIn: true, activeAttendanceId: null }),
      ),
    ).toBe(false);
  });

  it('CHECKED_IN with activeAttendanceId is checked in', () => {
    expect(
      isStudentCheckedIn(
        student({
          attendanceStatus: 'CHECKED_IN',
          activeAttendanceId: 'att-1',
          activeCheckIn: true,
          checkInAt: '2026-05-31T08:00:00.000Z',
        }),
      ),
    ).toBe(true);
  });

  it('CHECKED_IN without activeAttendanceId shows check in', () => {
    expect(
      isStudentCheckedIn(student({ attendanceStatus: 'CHECKED_IN', activeAttendanceId: null })),
    ).toBe(false);
  });
});
