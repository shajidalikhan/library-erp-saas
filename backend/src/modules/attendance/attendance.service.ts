import type { SortOrder } from 'mongoose';
import { Types } from 'mongoose';

import type { AuthenticatedUser } from '@/types/express';
import { ENV } from '@config/env.config';
import { ApiError } from '@utils/ApiError';
import { enrichRowsWithLookups } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seats.models';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

import { requireObjectId } from '@utils/object-id.util';
import { logActivity } from '@modules/activity/activity-audit.service';
import { verifyAttendanceQrToken } from './attendance-qr-token';
import { AttendanceModel } from './attendance.models';
import type { CheckOutSource } from './attendance.constants';
import { isCheckInLate } from './attendance-shift.util';
import type {
  AttendanceListQuery,
  AttendanceSummaryQuery,
  CheckInInput,
  CheckOutInput,
  ManualEntryInput,
  UpdateAttendanceInput,
} from './attendance.validation';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

const flattenAttendanceRow = (row: Record<string, unknown>) => {
  const student = row.studentId as Record<string, unknown> | null | undefined;
  const seat = row.seatId as Record<string, unknown> | null | undefined;
  const studentObjectId = student?._id ?? row.studentId;
  const seatObjectId = seat?._id ?? row.seatId;
  return {
    ...row,
    studentId: studentObjectId,
    studentName: student?.fullName ?? row.studentName ?? null,
    studentCode: student?.studentId ?? row.studentCode ?? null,
    studentPhone: student?.phone ?? row.studentPhone ?? null,
    seatId: seatObjectId,
    seatNumber: seat?.seatNumber ?? row.seatNumber ?? null,
    seatFloor: seat?.floor ?? row.seatFloor ?? null,
    seatZone: seat?.zone ?? row.seatZone ?? null,
  };
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function calcDurationMinutes(checkInAt: Date | null, checkOutAt: Date | null): number {
  if (!checkInAt || !checkOutAt) return 0;
  const diffMs = checkOutAt.getTime() - checkInAt.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / 60000);
}

function classifyOnCheckout(checkInAt: Date, checkOutAt: Date): 'PRESENT' | 'LATE' | 'EARLY_EXIT' | 'CHECKED_OUT' {
  const minutes = calcDurationMinutes(checkInAt, checkOutAt);
  const hour = checkInAt.getUTCHours();
  if (hour >= 10) return 'LATE';
  if (minutes < 240) return 'EARLY_EXIT';
  return 'CHECKED_OUT';
}

function dateKeyInTimezone(date: Date, timezone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '1970');
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '01');
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? '01');
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

async function getLibraryTimezone(libraryId: string): Promise<string> {
  const library = await LibraryModel.findById(libraryId).select('timezone').lean();
  return library?.timezone || 'Asia/Kolkata';
}

async function assertBranchInLibrary(branchId: string, libraryId: string) {
  const branch = await BranchModel.findOne({
    _id: new Types.ObjectId(branchId),
    libraryId: new Types.ObjectId(libraryId),
  })
    .select('_id libraryId')
    .lean();
  if (!branch) throw ApiError.badRequest('Branch not found for this library');
  return branch;
}

async function loadStudentForAttendance(
  user: AuthenticatedUser,
  studentId: string,
  context?: { libraryId?: string; branchId?: string },
) {
  const sid = requireObjectId(studentId, 'studentId');

  if (user.role === ROLES.SUPER_ADMIN) {
    const student = await StudentModel.findById(sid).lean();
    if (!student) throw ApiError.badRequest('Student not found');
    if (context?.libraryId && String(student.libraryId) !== context.libraryId) {
      throw ApiError.forbidden('Student is not in the selected library');
    }
    if (context?.branchId && String(student.branchId) !== context.branchId) {
      throw ApiError.forbidden('Student is not in the selected branch');
    }
    return student;
  }

  const libraryId = requireObjectId(
    context?.libraryId ?? user.libraryId,
    'libraryId',
  );
  const branchId =
    user.role === ROLES.MANAGER ||
    user.role === ROLES.RECEPTIONIST ||
    user.role === ROLES.SECURITY
      ? requireObjectId(user.branchId, 'branchId')
      : context?.branchId
        ? requireObjectId(context.branchId, 'branchId')
        : undefined;

  const filter: Record<string, unknown> = {
    _id: sid,
    libraryId,
  };
  if (branchId) filter.branchId = branchId;
  const student = await StudentModel.findOne(filter).lean();
  if (!student) throw ApiError.badRequest('Student not found in the selected tenant scope');
  return student;
}

async function loadStudentShift(
  studentId: Types.ObjectId,
  branchId: Types.ObjectId,
): Promise<{ startTime: string; endTime: string } | null> {
  const assignment = await SeatAssignmentModel.findOne({
    studentId,
    branchId,
    status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
  })
    .populate('shiftId', 'startTime endTime active')
    .lean();
  const shift = assignment?.shiftId as
    | { startTime?: string; endTime?: string; active?: boolean }
    | null
    | undefined;
  if (!shift?.startTime || !shift?.endTime || shift.active === false) return null;
  return { startTime: shift.startTime, endTime: shift.endTime };
}

async function loadSeatInTenant(seatId: string, libraryId: string, branchId: string) {
  const seat = await SeatModel.findOne({
    _id: requireObjectId(seatId, 'seatId'),
    libraryId: requireObjectId(libraryId, 'libraryId'),
    branchId: requireObjectId(branchId, 'branchId'),
  }).lean();
  if (!seat) throw ApiError.badRequest('Seat not found in student branch');
  return seat;
}

function assertAttendanceRead(user: AuthenticatedUser) {
  if (user.role === ROLES.SUPER_ADMIN || user.permissions.includes(PERMISSIONS.ATTENDANCE_READ)) return;
  throw ApiError.forbidden('Insufficient permissions to read attendance');
}

function assertAttendanceUpdate(user: AuthenticatedUser) {
  if (user.role === ROLES.SUPER_ADMIN || user.permissions.includes(PERMISSIONS.ATTENDANCE_UPDATE)) return;
  throw ApiError.forbidden('Insufficient permissions to update attendance');
}

function assertCheckIn(user: AuthenticatedUser) {
  if (
    user.role === ROLES.SUPER_ADMIN ||
    user.permissions.includes(PERMISSIONS.ATTENDANCE_CHECK_IN) ||
    user.permissions.includes(PERMISSIONS.ATTENDANCE_CREATE)
  ) {
    return;
  }
  throw ApiError.forbidden('Insufficient permissions to check in students');
}

function assertCheckOut(user: AuthenticatedUser) {
  if (
    user.role === ROLES.SUPER_ADMIN ||
    user.permissions.includes(PERMISSIONS.ATTENDANCE_CHECK_OUT) ||
    user.permissions.includes(PERMISSIONS.ATTENDANCE_CREATE)
  ) {
    return;
  }
  throw ApiError.forbidden('Insufficient permissions to check out students');
}

function scopedLibraryAndBranch(user: AuthenticatedUser): { libraryId?: string; branchId?: string } {
  if (user.role === ROLES.SUPER_ADMIN) return {};
  if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');

  if (user.role === ROLES.MANAGER || user.role === ROLES.RECEPTIONIST || user.role === ROLES.SECURITY) {
    if (!user.branchId) throw ApiError.forbidden('Branch context required');
    return { libraryId: user.libraryId, branchId: user.branchId };
  }
  return { libraryId: user.libraryId };
}

function applyReadScope(user: AuthenticatedUser, query: AttendanceListQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (user.role === ROLES.SUPER_ADMIN) {
    if (query.libraryId) filter.libraryId = requireObjectId(query.libraryId, 'libraryId');
    if (query.branchId) filter.branchId = requireObjectId(query.branchId, 'branchId');
    if (query.studentId) filter.studentId = requireObjectId(query.studentId, 'studentId');
    return filter;
  }

  if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
  filter.libraryId = new Types.ObjectId(user.libraryId);

  if (user.role === ROLES.MANAGER || user.role === ROLES.RECEPTIONIST || user.role === ROLES.SECURITY) {
    if (!user.branchId) throw ApiError.forbidden('Branch context required');
    filter.branchId = new Types.ObjectId(user.branchId);
  } else if (query.branchId) {
    filter.branchId = new Types.ObjectId(query.branchId);
  }

  if (user.role === ROLES.STUDENT) {
    // Best-effort "own-only" until studentId is added to JWT claims.
    filter.studentId = new Types.ObjectId(user.id);
  } else if (query.studentId) {
    filter.studentId = new Types.ObjectId(query.studentId);
  }

  return filter;
}

class AttendanceService {
  private assertCanScanAttendanceQr(user: AuthenticatedUser): void {
    if (user.role === ROLES.SUPER_ADMIN) return;
    const allowedRole =
      user.role === ROLES.MANAGER ||
      user.role === ROLES.RECEPTIONIST ||
      user.role === ROLES.SECURITY ||
      user.role === ROLES.LIBRARY_OWNER;
    if (!allowedRole) {
      throw ApiError.forbidden('QR attendance scanning is not available for your role');
    }
    if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
    if (
      (user.role === ROLES.MANAGER ||
        user.role === ROLES.RECEPTIONIST ||
        user.role === ROLES.SECURITY) &&
      !user.branchId
    ) {
      throw ApiError.forbidden('Branch context required for this device');
    }
  }

  private assertStaffQrScope(
    user: AuthenticatedUser,
    student: { libraryId: unknown; branchId: unknown },
  ): void {
    if (user.role === ROLES.SUPER_ADMIN) return;
    if (!user.libraryId || String(student.libraryId) !== user.libraryId) {
      throw ApiError.forbidden('Student is not in your library');
    }
    if (user.branchId && String(student.branchId) !== user.branchId) {
      throw ApiError.forbidden('Student is outside your branch');
    }
  }

  private assertQrClaimsMatchLiveStudent(
    claims: { sid: string; lid: string; bid: string },
    student: { _id: unknown; libraryId: unknown; branchId: unknown },
  ): void {
    if (String(student._id) !== claims.sid) {
      throw ApiError.badRequest('Invalid QR code');
    }
    if (String(student.libraryId) !== claims.lid || String(student.branchId) !== claims.bid) {
      throw ApiError.badRequest('This QR code is no longer valid. Ask the student to refresh.');
    }
  }

  async checkInStudent(user: AuthenticatedUser, input: CheckInInput) {
    assertCheckIn(user);
    const scope = scopedLibraryAndBranch(user);

    const student = await loadStudentForAttendance(user, input.studentId, {
      libraryId: input.libraryId ?? scope.libraryId,
      branchId: input.branchId ?? scope.branchId,
    });
    if (scope.branchId && String(student.branchId) !== scope.branchId) {
      throw ApiError.forbidden('Student is outside your branch scope');
    }

    const active = await AttendanceModel.findOne({
      libraryId: student.libraryId,
      branchId: student.branchId,
      studentId: student._id,
      checkOutAt: null,
    }).lean();
    if (active) throw ApiError.conflict('Student already checked in');

    if (input.seatId) {
      await loadSeatInTenant(input.seatId, String(student.libraryId), String(student.branchId));
    } else if (student.assignedSeatId) {
      await loadSeatInTenant(String(student.assignedSeatId), String(student.libraryId), String(student.branchId));
    }

    const checkInAt = input.checkInAt ?? new Date();
    const tz = await getLibraryTimezone(String(student.libraryId));
    const date = dateKeyInTimezone(checkInAt, tz);
    const shift = await loadStudentShift(student._id as Types.ObjectId, student.branchId as Types.ObjectId);
    const status = isCheckInLate({
      checkInAt,
      sessionDateKey: date,
      shift,
      graceMinutes: ENV.ATTENDANCE_LATE_GRACE_MINUTES,
    })
      ? 'LATE'
      : 'CHECKED_IN';

    const doc = await AttendanceModel.create({
      libraryId: student.libraryId,
      branchId: student.branchId,
      studentId: student._id,
      seatId: input.seatId ? requireObjectId(input.seatId, 'seatId') : student.assignedSeatId ?? null,
      date,
      checkInAt,
      checkOutAt: null,
      durationMinutes: 0,
      status,
      method: input.method,
      notes: input.notes?.trim(),
      createdBy: requireObjectId(user.id, 'userId'),
      updatedBy: requireObjectId(user.id, 'userId'),
    });

    logActivity({
      actorUserId: user.id,
      action: 'ATTENDANCE_CHECK_IN',
      entityType: 'STUDENT',
      entityId: String(student._id),
      libraryId: String(student.libraryId),
      branchId: String(student.branchId),
      metadata: {
        studentName: student.fullName,
        entityLabel: student.fullName,
        description: `${student.fullName} checked in`,
      },
    });

    return toJSON(doc.toObject());
  }

  async checkOutStudent(user: AuthenticatedUser, input: CheckOutInput) {
    assertCheckOut(user);
    const scope = scopedLibraryAndBranch(user);
    const student = await loadStudentForAttendance(user, input.studentId, {
      libraryId: input.libraryId ?? scope.libraryId,
      branchId: input.branchId ?? scope.branchId,
    });

    const active = await AttendanceModel.findOne({
      libraryId: student.libraryId,
      branchId: student.branchId,
      studentId: student._id,
      checkOutAt: null,
    });
    if (!active || !active.checkInAt) throw ApiError.badRequest('No active check-in found');

    const checkOutAt = input.checkOutAt ?? new Date();
    if (checkOutAt < active.checkInAt) throw ApiError.badRequest('checkOutAt cannot be before checkInAt');

    active.checkOutAt = checkOutAt;
    active.durationMinutes = calcDurationMinutes(active.checkInAt, checkOutAt);
    active.status = classifyOnCheckout(active.checkInAt, checkOutAt);
    active.checkOutSource = (input.checkOutSource ?? 'MANUAL') satisfies CheckOutSource;
    if (input.notes !== undefined) active.notes = input.notes?.trim();
    active.updatedBy = requireObjectId(user.id, 'userId');
    await active.save();
    logActivity({
      actorUserId: user.id,
      action: 'ATTENDANCE_CHECK_OUT',
      entityType: 'STUDENT',
      entityId: String(student._id),
      libraryId: String(student.libraryId),
      branchId: String(student.branchId),
      metadata: {
        studentName: student.fullName,
        entityLabel: student.fullName,
        description: `${student.fullName} checked out`,
      },
    });
    return toJSON(active.toObject());
  }

  async manualEntry(user: AuthenticatedUser, input: ManualEntryInput) {
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      !user.permissions.includes(PERMISSIONS.ATTENDANCE_CREATE)
    ) {
      throw ApiError.forbidden('Insufficient permissions to create attendance');
    }

    const scope = scopedLibraryAndBranch(user);
    const student = await loadStudentForAttendance(user, input.studentId, {
      libraryId: scope.libraryId,
      branchId: scope.branchId,
    });
    const seatId = input.seatId ? new Types.ObjectId(input.seatId) : student.assignedSeatId ?? null;
    if (seatId) {
      await loadSeatInTenant(String(seatId), String(student.libraryId), String(student.branchId));
    }

    const baseDate = input.date ?? input.checkInAt ?? input.checkOutAt ?? new Date();
    const tz = await getLibraryTimezone(String(student.libraryId));
    const date = dateKeyInTimezone(baseDate, tz);
    const durationMinutes = calcDurationMinutes(input.checkInAt ?? null, input.checkOutAt ?? null);

    let status = input.status;
    if (!status) {
      if (input.checkInAt && input.checkOutAt) {
        status = classifyOnCheckout(input.checkInAt, input.checkOutAt);
      } else if (input.checkInAt) {
        status = 'CHECKED_IN';
      } else {
        status = 'ABSENT';
      }
    }

    const doc = await AttendanceModel.create({
      libraryId: student.libraryId,
      branchId: student.branchId,
      studentId: student._id,
      seatId,
      date,
      checkInAt: input.checkInAt ?? null,
      checkOutAt: input.checkOutAt ?? null,
      durationMinutes,
      status,
      method: input.method,
      notes: input.notes?.trim(),
      createdBy: new Types.ObjectId(user.id),
      updatedBy: new Types.ObjectId(user.id),
    });
    return toJSON(doc.toObject());
  }

  async listDaily(user: AuthenticatedUser, query: AttendanceListQuery) {
    assertAttendanceRead(user);
    const filter: Record<string, unknown> = applyReadScope(user, query);

    if (query.dateFrom || query.dateTo) {
      filter.date = {};
      if (query.dateFrom) (filter.date as Record<string, unknown>).$gte = query.dateFrom;
      if (query.dateTo) (filter.date as Record<string, unknown>).$lte = query.dateTo;
    }
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      const students = await StudentModel.find({
        $or: [{ fullName: rx }, { studentId: rx }, { phone: rx }],
      })
        .select('_id')
        .lean();
      filter.studentId = {
        ...(filter.studentId ? { $eq: filter.studentId } : {}),
        $in: students.map((s) => s._id),
      };
    }
    if (query.method) filter.method = query.method;
    if (query.status) filter.status = query.status;
    if (query.activeOnly === true) filter.checkOutAt = null;
    if (query.seatId) filter.seatId = new Types.ObjectId(query.seatId);
    if (query.shiftId) {
      const { SeatAssignmentModel } = await import('@modules/seats/seat-assignment.model');
      const { SHIFT_ASSIGNMENT_STATUS } = await import('@modules/shifts/shift.constants');
      const studentIds = await SeatAssignmentModel.distinct('studentId', {
        shiftId: new Types.ObjectId(query.shiftId),
        status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
      });
      filter.studentId = { $in: studentIds };
    }

    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [rows, total] = await Promise.all([
      AttendanceModel.find(filter)
        .populate('studentId', 'fullName studentId phone')
        .populate('seatId', 'seatNumber floor zone')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      AttendanceModel.countDocuments(filter),
    ]);

    return {
      items: (
        await enrichRowsWithLookups(
          rows.map((row) => flattenAttendanceRow(toJSON(row) as Record<string, unknown>)),
          { branchIdKey: 'branchId', userIdKeys: ['createdBy', 'updatedBy'] },
        )
      ).map((row) => toJSON(row)),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getStudentHistory(user: AuthenticatedUser, studentId: string, query: AttendanceListQuery) {
    assertAttendanceRead(user);
    const scoped = applyReadScope(user, query);
    const filter: Record<string, unknown> = {
      ...scoped,
      studentId: new Types.ObjectId(studentId),
    };
    if (query.dateFrom || query.dateTo) {
      filter.date = {};
      if (query.dateFrom) (filter.date as Record<string, unknown>).$gte = query.dateFrom;
      if (query.dateTo) (filter.date as Record<string, unknown>).$lte = query.dateTo;
    }

    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const [rows, total] = await Promise.all([
      AttendanceModel.find(filter)
        .populate('studentId', 'fullName studentId phone')
        .populate('seatId', 'seatNumber floor zone')
        .sort({ date: -1, checkInAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AttendanceModel.countDocuments(filter),
    ]);

    return {
      items: (
        await enrichRowsWithLookups(
          rows.map((row) => flattenAttendanceRow(toJSON(row) as Record<string, unknown>)),
          { branchIdKey: 'branchId', userIdKeys: ['createdBy', 'updatedBy'] },
        )
      ).map((row) => toJSON(row)),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getActiveCheckIns(user: AuthenticatedUser, query: AttendanceListQuery) {
    return this.listDaily(user, { ...query, activeOnly: true });
  }

  async getSummary(user: AuthenticatedUser, query: AttendanceSummaryQuery) {
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      !user.permissions.includes(PERMISSIONS.ATTENDANCE_SUMMARY) &&
      !user.permissions.includes(PERMISSIONS.ATTENDANCE_READ)
    ) {
      throw ApiError.forbidden('Insufficient permissions to view attendance summary');
    }

    const baseScope = applyReadScope(user, {
      page: 1,
      limit: 1,
      sortBy: 'date',
      sortOrder: 'desc',
      activeOnly: undefined,
      ...query,
    });
    const filter: Record<string, unknown> = { ...baseScope };
    if (query.dateFrom || query.dateTo) {
      filter.date = {};
      if (query.dateFrom) (filter.date as Record<string, unknown>).$gte = query.dateFrom;
      if (query.dateTo) (filter.date as Record<string, unknown>).$lte = query.dateTo;
    }

    const [total, activeCount, checkedOutCount, lateCount, earlyExitCount] = await Promise.all([
      AttendanceModel.countDocuments(filter),
      AttendanceModel.countDocuments({ ...filter, checkOutAt: null }),
      AttendanceModel.countDocuments({ ...filter, status: 'CHECKED_OUT' }),
      AttendanceModel.countDocuments({ ...filter, status: 'LATE' }),
      AttendanceModel.countDocuments({ ...filter, status: 'EARLY_EXIT' }),
    ]);

    const byBranchRaw = await AttendanceModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: filter },
      { $group: { _id: '$branchId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const branchRows = await enrichRowsWithLookups(
      byBranchRaw.map((row) => ({ branchId: row._id, count: row.count })) as Record<string, unknown>[],
      { branchIdKey: 'branchId' },
    );

    return {
      total,
      activeCheckIns: activeCount,
      checkedOut: checkedOutCount,
      lateEntries: lateCount,
      earlyExits: earlyExitCount,
      byBranch: branchRows.map((row) => ({
        branchId: String(row.branchId),
        branchName: row.branchName ?? null,
        branchCode: row.branchCode ?? null,
        count: row.count as number,
      })),
    };
  }

  async updateAttendance(user: AuthenticatedUser, attendanceId: string, input: UpdateAttendanceInput) {
    assertAttendanceUpdate(user);
    const doc = await AttendanceModel.findById(attendanceId);
    if (!doc) throw ApiError.notFound('Attendance record not found');

    const scoped = applyReadScope(user, {
      page: 1,
      limit: 1,
      sortBy: 'date',
      sortOrder: 'desc',
      activeOnly: undefined,
    });
    if (scoped.libraryId && String(doc.libraryId) !== String(scoped.libraryId)) {
      throw ApiError.forbidden('You do not have access to this attendance record');
    }
    if (scoped.branchId && String(doc.branchId) !== String(scoped.branchId)) {
      throw ApiError.forbidden('You do not have access to this attendance record');
    }

    if (input.status !== undefined) doc.status = input.status;
    if (input.notes !== undefined) doc.notes = input.notes?.trim();
    if (input.method !== undefined) doc.method = input.method;
    if (input.checkInAt !== undefined) doc.checkInAt = input.checkInAt;
    if (input.checkOutAt !== undefined) doc.checkOutAt = input.checkOutAt;
    doc.durationMinutes = calcDurationMinutes(doc.checkInAt, doc.checkOutAt);
    doc.updatedBy = new Types.ObjectId(user.id);
    await doc.save();
    return toJSON(doc.toObject());
  }

  async resolveAttendanceQr(user: AuthenticatedUser, qrToken: string) {
    this.assertCanScanAttendanceQr(user);
    const claims = verifyAttendanceQrToken(qrToken);
    const student = await StudentModel.findById(claims.sid)
      .select('fullName studentId phone libraryId branchId assignedSeatId')
      .lean();
    if (!student) throw ApiError.badRequest('Invalid QR code');
    this.assertQrClaimsMatchLiveStudent(claims, student);
    this.assertStaffQrScope(user, student);

    const active = await AttendanceModel.findOne({
      libraryId: student.libraryId,
      branchId: student.branchId,
      studentId: student._id,
      checkOutAt: null,
    }).lean();

    const branch = await BranchModel.findById(student.branchId).select('branchName branchCode').lean();
    let seatNumber: string | null = null;
    if (student.assignedSeatId) {
      const seat = await SeatModel.findById(student.assignedSeatId).select('seatNumber').lean();
      seatNumber = seat?.seatNumber != null ? String(seat.seatNumber) : null;
    }

    const activeCheckIn = Boolean(active?.checkInAt != null && active.checkOutAt == null);

    return {
      studentId: String(student._id),
      studentName: student.fullName ?? null,
      studentCode: student.studentId ?? null,
      phone: student.phone ?? null,
      branchName: branch?.branchName ?? null,
      branchCode: branch?.branchCode ?? null,
      seatNumber,
      activeCheckIn,
    };
  }

  async qrCheckInStudent(user: AuthenticatedUser, qrToken: string) {
    return this.checkInStudent(user, {
      studentId: (await this.resolveAttendanceQr(user, qrToken)).studentId,
      method: 'QR',
    });
  }

  async qrCheckOutStudent(user: AuthenticatedUser, qrToken: string) {
    return this.checkOutStudent(user, {
      studentId: (await this.resolveAttendanceQr(user, qrToken)).studentId,
      checkOutSource: 'QR',
    });
  }
}

export const attendanceService = new AttendanceService();

export const __attendanceTestables = {
  calcDurationMinutes,
  classifyOnCheckout,
  dateKeyInTimezone,
  applyReadScope,
  isCheckInLate,
};
