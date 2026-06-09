import { Types } from 'mongoose';

import { ENV } from '@config/env.config';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { mediaUrlFromField } from '@utils/media-asset.schema';
import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seat.model';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { ShiftModel } from '@modules/shifts/shift.model';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';
import { InvoiceModel } from '@modules/payments/payments.models';
import { seatOccupancyService } from '@modules/seats/seat-occupancy.service';

import { AttendanceModel } from './attendance.models';
import type { AttendanceBoardQuery } from './attendance.validation';
import { __attendanceTestables } from './attendance.service';
import type { BoardAttendanceStatus, BoardGridState } from './attendance-board.constants';
import type { CheckOutSource } from './attendance.constants';
import {
  deriveBoardStatusForStudent,
  deriveGridState,
  isLateWithoutCheckIn,
  isOpenAttendanceSession,
  membershipStatusLabel,
  resolveActiveAttendanceId,
  resolveBoardSessionTimes,
  resolveBoardStudentAttendance,
} from './attendance-board.util';

const { dateKeyInTimezone } = __attendanceTestables;

type AttendanceDoc = {
  _id: Types.ObjectId;
  studentId: Types.ObjectId;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  status: string;
  checkOutSource?: CheckOutSource | null;
  durationMinutes?: number;
  date?: Date;
};

async function getLibraryTimezone(libraryId: string): Promise<string> {
  const library = await LibraryModel.findById(libraryId).select('timezone').lean();
  return library?.timezone || 'Asia/Kolkata';
}

function resolveBranchId(user: AuthenticatedUser, query: AttendanceBoardQuery): string {
  if (user.role === ROLES.MANAGER || user.role === ROLES.RECEPTIONIST || user.role === ROLES.SECURITY) {
    if (!user.branchId) throw ApiError.forbidden('Branch context required');
    return user.branchId;
  }
  if (!query.branchId) throw ApiError.badRequest('branchId is required');
  return query.branchId;
}

function assertBoardRead(user: AuthenticatedUser): void {
  if (user.role === ROLES.SUPER_ADMIN || user.permissions.includes(PERMISSIONS.ATTENDANCE_READ)) return;
  throw ApiError.forbidden('Insufficient permissions to view attendance board');
}

function assertBranchTenant(
  user: AuthenticatedUser,
  branch: { _id: Types.ObjectId; libraryId: Types.ObjectId },
): void {
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (!user.libraryId || String(branch.libraryId) !== user.libraryId) {
    throw ApiError.forbidden('Branch is not in your library');
  }
  if (user.branchId && String(branch._id) !== user.branchId) {
    throw ApiError.forbidden('You do not have access to this branch');
  }
}

function pickBestDayRecord(
  rows: AttendanceDoc[],
  sid: string,
): AttendanceDoc | null {
  let best: AttendanceDoc | null = null;
  for (const row of rows) {
    if (String(row.studentId) !== sid) continue;
    if (!row.checkInAt) continue;
    if (!best || row.checkInAt > best.checkInAt!) {
      best = row;
    }
  }
  return best;
}

class AttendanceBoardService {
  async getBoard(user: AuthenticatedUser, query: AttendanceBoardQuery) {
    assertBoardRead(user);

    const branchId = resolveBranchId(user, query);
    const branch = await BranchModel.findById(branchId).lean();
    if (!branch) throw ApiError.notFound('Branch not found');

    if (user.role === ROLES.SUPER_ADMIN && query.libraryId) {
      if (String(branch.libraryId) !== query.libraryId) {
        throw ApiError.badRequest('Branch does not belong to the selected library');
      }
    }
    assertBranchTenant(user, branch as { _id: Types.ObjectId; libraryId: Types.ObjectId });

    const libraryId = String(branch.libraryId);
    const tz = await getLibraryTimezone(libraryId);
    const anchor = query.date ?? new Date();
    const dateKey = dateKeyInTimezone(anchor, tz);
    const todayDateKey = dateKeyInTimezone(new Date(), tz);
    const dateEnd = new Date(dateKey);
    dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);

    const shiftFilter: Record<string, unknown> = { branchId: branch._id, active: true };
    if (query.shiftId) shiftFilter._id = new Types.ObjectId(query.shiftId);

    const [shifts, seats, students, assignments, dayAttendanceRows, activeSessions, occupancyGrid] =
      await Promise.all([
        ShiftModel.find(shiftFilter).sort({ startTime: 1 }).lean(),
        SeatModel.find({ branchId: branch._id, active: true }).sort({ seatNumber: 1 }).lean(),
        StudentModel.find({
          branchId: branch._id,
          libraryId: branch.libraryId,
          status: { $in: ['ACTIVE', 'SUSPENDED'] },
        })
          .select(
            'fullName studentId phone profilePhoto assignedSeatId currentShiftId membershipStartDate membershipEndDate status',
          )
          .lean(),
        SeatAssignmentModel.find({
          branchId: branch._id,
          status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
          ...(query.shiftId ? { shiftId: new Types.ObjectId(query.shiftId) } : {}),
        })
          .populate('shiftId', 'name startTime endTime')
          .populate('studentId', 'fullName studentId phone profilePhoto membershipEndDate status')
          .lean(),
        AttendanceModel.find({
          branchId: branch._id,
          date: { $gte: dateKey, $lt: dateEnd },
        }).lean(),
        AttendanceModel.find({
          libraryId: branch.libraryId,
          branchId: branch._id,
          checkOutAt: null,
          checkInAt: { $ne: null },
        }).lean(),
        seatOccupancyService.getGrid(user, { branchId }),
      ]);

    const studentIds = students.map((s) => s._id as Types.ObjectId);
    const dueAgg =
      studentIds.length > 0
        ? await InvoiceModel.aggregate<{ _id: Types.ObjectId; dueAmount: number }>([
            {
              $match: {
                libraryId: branch.libraryId,
                branchId: branch._id,
                studentId: { $in: studentIds },
                dueAmount: { $gt: 0.01 },
                status: { $in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
              },
            },
            { $group: { _id: '$studentId', dueAmount: { $sum: '$dueAmount' } } },
          ])
        : [];
    const dueByStudent = new Map(dueAgg.map((d) => [String(d._id), d.dueAmount]));

    const activeByStudent = new Map<string, AttendanceDoc>();
    for (const row of activeSessions as AttendanceDoc[]) {
      activeByStudent.set(String(row.studentId), row);
    }

    const dayByStudent = new Map<string, AttendanceDoc | null>();
    for (const student of students) {
      const sid = String(student._id);
      dayByStudent.set(sid, pickBestDayRecord(dayAttendanceRows as AttendanceDoc[], sid));
    }

    const assignmentByStudent = new Map<string, (typeof assignments)[0]>();
    for (const a of assignments) {
      const sid = String(a.studentId?._id ?? a.studentId);
      if (!assignmentByStudent.has(sid)) assignmentByStudent.set(sid, a);
    }

    const seatById = new Map(seats.map((s) => [String(s._id), s]));
    const now = new Date();
    const lateGraceMinutes = ENV.ATTENDANCE_LATE_GRACE_MINUTES;

    const boardStudents = students.map((student) => {
      const sid = String(student._id);
      const assignment = assignmentByStudent.get(sid);
      const shiftDoc = assignment?.shiftId as
        | { _id?: Types.ObjectId; name?: string; startTime?: string; endTime?: string }
        | undefined;
      const shiftTimes =
        shiftDoc?.startTime && shiftDoc?.endTime
          ? { startTime: shiftDoc.startTime, endTime: shiftDoc.endTime }
          : null;

      const active = activeByStudent.get(sid) ?? null;
      const dayAtt = dayByStudent.get(sid) ?? null;
      const checkInDateKey = active?.checkInAt ? dateKeyInTimezone(active.checkInAt, tz) : null;

      const att = resolveBoardStudentAttendance({
        activeSession: active,
        daySession: dayAtt,
        boardDateKey: dateKey,
        todayDateKey,
        checkInDateKey,
      });

      const openSession = isOpenAttendanceSession(active) ? active : null;
      const attendanceStatus = deriveBoardStatusForStudent({
        attendance: att,
        activeOpenSession: openSession,
        shift: shiftTimes,
        now,
        boardDateKey: dateKey,
        todayDateKey,
        lateGraceMinutes,
      });
      const activeAttendanceId = resolveActiveAttendanceId(openSession);
      const sessionTimes = resolveBoardSessionTimes({
        attendance: att,
        openSession,
        now,
      });

      const seatId = assignment
        ? String(assignment.seatId)
        : student.assignedSeatId
          ? String(student.assignedSeatId)
          : null;
      const seat = seatId ? seatById.get(seatId) : undefined;

      return {
        studentId: sid,
        studentName: student.fullName,
        studentCode: student.studentId,
        phone: student.phone ?? null,
        photoUrl: mediaUrlFromField(student.profilePhoto),
        seatNumber: seat?.seatNumber ?? null,
        seatId,
        shiftName: shiftDoc?.name ?? null,
        shiftId: shiftDoc?._id ? String(shiftDoc._id) : student.currentShiftId ? String(student.currentShiftId) : null,
        membershipStatus: membershipStatusLabel(student.status, student.membershipEndDate, now),
        membershipEndDate: student.membershipEndDate ?? null,
        attendanceStatus,
        activeAttendanceId,
        activeCheckIn: Boolean(activeAttendanceId),
        checkOutSource: sessionTimes.checkOutAt ? (att?.checkOutSource ?? 'MANUAL') : null,
        checkInAt: sessionTimes.checkInAt,
        checkOutAt: sessionTimes.checkOutAt,
        durationMinutes: sessionTimes.durationMinutes,
        dueAmount: dueByStudent.get(sid) ?? 0,
        attendanceId: activeAttendanceId ?? (att?._id ? String(att._id) : null),
      };
    });

    const assignmentBySeatShift = new Map<string, (typeof assignments)[0]>();
    for (const a of assignments) {
      const key = `${String(a.seatId)}:${String(a.shiftId?._id ?? a.shiftId)}`;
      assignmentBySeatShift.set(key, a);
    }

    const grid: Array<{
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
        membershipEndDate: Date | string | null;
      } | null;
      attendance: {
        attendanceStatus: BoardAttendanceStatus;
        activeAttendanceId: string | null;
        checkInAt: Date | null;
        checkOutAt: Date | null;
        durationMinutes: number;
        checkOutSource: CheckOutSource | null;
      } | null;
    }> = [];

    for (const shift of shifts) {
      const shiftId = String(shift._id);
      const shiftTimes = { startTime: shift.startTime, endTime: shift.endTime };
      const shiftCells = occupancyGrid.cells[shiftId] ?? {};
      for (const seat of seats) {
        const seatId = String(seat._id);
        const occ = shiftCells[seatId];
        const key = `${seatId}:${shiftId}`;
        const assignment = assignmentBySeatShift.get(key);
        const studentRef = assignment?.studentId as Record<string, unknown> | undefined;
        const sid = studentRef?._id ? String(studentRef._id) : assignment ? String(assignment.studentId) : null;

        const active = sid ? activeByStudent.get(sid) ?? null : null;
        const dayAtt = sid ? dayByStudent.get(sid) ?? null : null;
        const checkInDateKey = active?.checkInAt ? dateKeyInTimezone(active.checkInAt, tz) : null;
        const att = sid
          ? resolveBoardStudentAttendance({
              activeSession: active,
              daySession: dayAtt,
              boardDateKey: dateKey,
              todayDateKey,
              checkInDateKey,
            })
          : null;

        const openSession = sid && isOpenAttendanceSession(active) ? active : null;
        const attendanceStatus = sid
          ? deriveBoardStatusForStudent({
              attendance: att,
              activeOpenSession: openSession,
              shift: shiftTimes,
              now,
              boardDateKey: dateKey,
              todayDateKey,
              lateGraceMinutes,
            })
          : 'NOT_CHECKED_IN';

        const occupancyBlocked =
          occ?.state === 'BLOCKED' || occ?.state === 'PUBLIC_HOLD' || occ?.state === 'RESERVED';
        const hasAssignment = Boolean(assignment && sid);

        const lateWithoutCheckIn = sid
          ? isLateWithoutCheckIn({
              attendance: att,
              activeOpenSession: openSession,
              shift: shiftTimes,
              now,
              boardDateKey: dateKey,
              todayDateKey,
              lateGraceMinutes,
            })
          : false;

        const state = deriveGridState({
          hasAssignment,
          occupancyBlocked,
          attendance: openSession ?? att,
          lateWithoutCheckIn,
        });

        const cellTimes = resolveBoardSessionTimes({
          attendance: att,
          openSession,
          now,
        });

        grid.push({
          seatId,
          seatNumber: seat.seatNumber,
          shiftId,
          shiftName: shift.name,
          shiftTime: `${shift.startTime}–${shift.endTime}`,
          state,
          student:
            hasAssignment && studentRef
              ? {
                  studentId: sid!,
                  studentName: String(studentRef.fullName ?? ''),
                  studentCode: String(studentRef.studentId ?? ''),
                  phone: (studentRef.phone as string) ?? null,
                  membershipEndDate: (studentRef.membershipEndDate as Date) ?? null,
                }
              : null,
          attendance: sid
            ? {
                attendanceStatus,
                activeAttendanceId: resolveActiveAttendanceId(openSession),
                checkInAt: cellTimes.checkInAt,
                checkOutAt: cellTimes.checkOutAt,
                durationMinutes: cellTimes.durationMinutes,
                checkOutSource: cellTimes.checkOutAt ? (att?.checkOutSource ?? 'MANUAL') : null,
              }
            : null,
        });
      }
    }

    const summary = {
      totalAssigned: assignments.length,
      checkedIn: boardStudents.filter((s) => s.attendanceStatus === 'CHECKED_IN').length,
      checkedOut: boardStudents.filter((s) => s.attendanceStatus === 'CHECKED_OUT').length,
      autoCheckedOut: boardStudents.filter((s) => s.attendanceStatus === 'CHECKED_OUT_AUTO').length,
      notCheckedIn: boardStudents.filter((s) => s.attendanceStatus === 'NOT_CHECKED_IN').length,
      late: boardStudents.filter((s) => s.attendanceStatus === 'LATE').length,
      absent: grid.filter((c) => c.state === 'ABSENT').length,
      activeInside: boardStudents.filter(
        (s) => s.attendanceStatus === 'CHECKED_IN' || s.attendanceStatus === 'LATE',
      ).length,
    };

    return {
      branch: {
        _id: String(branch._id),
        branchName: branch.branchName,
        branchCode: branch.branchCode,
      },
      date: dateKey.toISOString(),
      shifts: shifts.map((s) => ({
        _id: String(s._id),
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        type: s.type,
        color: s.color,
      })),
      seats: seats.map((s) => ({
        _id: String(s._id),
        seatNumber: s.seatNumber,
        floor: s.floor,
        zone: s.zone,
      })),
      students: boardStudents,
      grid,
      summary,
    };
  }
}

export const attendanceBoardService = new AttendanceBoardService();

export const __attendanceBoardTestables = {
  resolveBoardStudentAttendance,
  pickBestDayRecord,
};
