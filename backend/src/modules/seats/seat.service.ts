import type { SortOrder } from 'mongoose';
import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { enrichRowsWithLookups } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { BranchModel } from '@modules/library/library.models';
import { ShiftModel } from '@modules/shifts/shift.model';
import { StudentModel } from '@modules/students/students.models';

import { SEAT_STATUSES } from './seat.constants';
import type { SeatStatus, SeatType } from './seat.constants';
import { SeatModel } from './seat.model';
import {
  SHIFT_ASSIGNMENT_STATUS,
  type ShiftAssignmentStatus,
} from '@modules/shifts/shift.constants';

export type ReleasedSeatInfo = {
  seatId: string;
  seatNumber: string;
  shiftId: string;
  shiftName: string | null;
};

export type ReleaseStudentSeatsOptions = {
  reason?: string;
  assignmentStatus?: ShiftAssignmentStatus;
};

import {
  cancelAllSeatAssignments,
  createSeatAssignment,
  enrichSeatsWithShiftAssignments,
  syncSeatOccupancyFlags,
} from './seat-assignment.service';
import { SeatAssignmentModel } from './seat-assignment.model';
import { PLAN_LIMIT_ENTITY } from '@modules/subscription-billing/subscription-limit.constants';
import { subscriptionLimitService } from '@modules/subscription-billing/subscription-limit.service';
import { resolveShiftIdForStudentSeatAssignment } from './seat-shift-migration.util';
import type {
  AssignSeatInput,
  BulkCreateSeatsInput,
  CreateSeatInput,
  ListSeatsQuery,
  OccupancySummaryQuery,
  UpdateSeatInput,
} from './seat.validation';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireLibraryContext(user: AuthenticatedUser): string {
  if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
  return user.libraryId;
}

async function assertBranchInTenant(
  branchId: string,
  libraryId: string,
): Promise<{ _id: Types.ObjectId; libraryId: Types.ObjectId }> {
  const branch = await BranchModel.findOne({
    _id: new Types.ObjectId(branchId),
    libraryId: new Types.ObjectId(libraryId),
  })
    .select('_id libraryId')
    .lean();
  if (!branch) throw ApiError.badRequest('Branch not found for this library');
  return branch as { _id: Types.ObjectId; libraryId: Types.ObjectId };
}

export function hasFullSeatRead(user: AuthenticatedUser): boolean {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.permissions.includes(PERMISSIONS.SEAT_READ);
}

export function canAccessSeatList(user: AuthenticatedUser): boolean {
  return (
    hasFullSeatRead(user) || user.permissions.includes(PERMISSIONS.SEAT_OCCUPANCY_READ)
  );
}

function projectSeatForUser(user: AuthenticatedUser, row: Record<string, unknown>): Record<string, unknown> {
  if (hasFullSeatRead(user)) return row;
  if (user.permissions.includes(PERMISSIONS.SEAT_OCCUPANCY_READ)) {
    return {
      _id: row._id,
      libraryId: row.libraryId,
      branchId: row.branchId,
      seatNumber: row.seatNumber,
      floor: row.floor,
      zone: row.zone,
      seatType: row.seatType,
      status: row.status,
      occupied: row.occupied,
      active: row.active,
      assignedStudentId: row.assignedStudentId,
      reservedUntil: row.reservedUntil,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
  return row;
}

/** List / read scope for tenant actors. */
function applyListScope(
  user: AuthenticatedUser,
  query: ListSeatsQuery,
): { filter: Record<string, unknown>; extraDenied?: boolean } {
  const filter: Record<string, unknown> = {};

  if (user.role === ROLES.SUPER_ADMIN) {
    if (query.libraryId) filter.libraryId = new Types.ObjectId(query.libraryId);
    if (query.branchId) filter.branchId = new Types.ObjectId(query.branchId);
    return { filter };
  }

  const lib = requireLibraryContext(user);
  filter.libraryId = new Types.ObjectId(lib);

  if (user.role === ROLES.MANAGER || user.role === ROLES.RECEPTIONIST) {
    if (!user.branchId) throw ApiError.forbidden('Branch assignment required');
    filter.branchId = new Types.ObjectId(user.branchId);
  } else if (user.role === ROLES.LIBRARY_OWNER) {
    if (query.branchId) {
      filter.branchId = new Types.ObjectId(query.branchId);
    }
  } else if (
    user.role === ROLES.ACCOUNTANT ||
    user.role === ROLES.SECURITY ||
    user.role === ROLES.STUDENT
  ) {
    if (user.branchId) {
      filter.branchId = new Types.ObjectId(user.branchId);
    }
  } else {
    throw ApiError.forbidden('Insufficient permissions');
  }

  return { filter };
}

async function assertSeatRowRead(user: AuthenticatedUser, seat: { libraryId: unknown; branchId: unknown }) {
  if (user.role === ROLES.SUPER_ADMIN) return;

  const lib = requireLibraryContext(user);
  if (String(seat.libraryId) !== lib) {
    throw ApiError.forbidden('You do not have access to this seat');
  }

  if (user.role === ROLES.MANAGER || user.role === ROLES.RECEPTIONIST) {
    if (!user.branchId || String(seat.branchId) !== user.branchId) {
      throw ApiError.forbidden('You do not have access to this seat');
    }
  } else if (user.branchId && String(seat.branchId) !== user.branchId) {
    throw ApiError.forbidden('You do not have access to this seat');
  }
}

function assertAssignableSeat(
  seat: {
    active: boolean;
    status: string;
    reservedUntil: Date | null;
    assignedStudentId: Types.ObjectId | null;
  },
  options?: { shiftBased?: boolean },
) {
  if (!seat.active) throw ApiError.badRequest('Seat is inactive');
  if (seat.status === 'MAINTENANCE' || seat.status === 'BLOCKED') {
    throw ApiError.badRequest('Seat cannot be assigned in its current status');
  }
  if (seat.status === 'RESERVED' && seat.reservedUntil && seat.reservedUntil > new Date()) {
    throw ApiError.badRequest('Reserved seat cannot be assigned until reservation expires');
  }
  if (seat.assignedStudentId && !options?.shiftBased) {
    throw ApiError.badRequest('Seat is already assigned; unassign first');
  }
}

class SeatService {
  async createSeat(user: AuthenticatedUser, input: CreateSeatInput) {
    if (!user.permissions.includes(PERMISSIONS.SEAT_CREATE)) {
      throw ApiError.forbidden('Insufficient permissions to create seats');
    }

    if (user.role !== ROLES.SUPER_ADMIN) {
      const lib = requireLibraryContext(user);
      if (String(input.libraryId) !== lib) throw ApiError.forbidden('libraryId must be your tenant library');
      if (user.role === ROLES.MANAGER || user.role === ROLES.RECEPTIONIST) {
        if (!user.branchId || String(input.branchId) !== user.branchId) {
          throw ApiError.forbidden('branchId must be your assigned branch');
        }
      }
    }

    await assertBranchInTenant(input.branchId, input.libraryId);

    const exists = await SeatModel.exists({
      branchId: new Types.ObjectId(input.branchId),
      seatNumber: input.seatNumber.trim(),
    });
    if (exists) throw ApiError.conflict('Seat number already exists in this branch');

    await subscriptionLimitService.validateLimitBeforeCreate(PLAN_LIMIT_ENTITY.SEATS, String(input.libraryId), {
      actorUserId: user.id,
    });

    const doc = await SeatModel.create({
      libraryId: new Types.ObjectId(input.libraryId),
      branchId: new Types.ObjectId(input.branchId),
      seatNumber: input.seatNumber.trim(),
      floor: input.floor.trim(),
      zone: input.zone.trim(),
      seatType: input.seatType,
      notes: input.notes?.trim(),
      status: input.status,
      reservedUntil: input.reservedUntil ?? null,
      active: input.active ?? true,
      assignedStudentId: null,
      occupied: false,
    });

    const out = await SeatModel.findById(doc._id).lean();
    return toJSON(projectSeatForUser(user, out as unknown as Record<string, unknown>));
  }

  async updateSeat(user: AuthenticatedUser, seatId: string, input: UpdateSeatInput) {
    if (!user.permissions.includes(PERMISSIONS.SEAT_UPDATE)) {
      throw ApiError.forbidden('Insufficient permissions to update seats');
    }

    const seat = await SeatModel.findById(seatId);
    if (!seat) throw ApiError.notFound('Seat not found');
    await assertSeatRowRead(user, seat);

    if (input.seatNumber !== undefined && input.seatNumber.trim() !== seat.seatNumber) {
      const dup = await SeatModel.exists({
        branchId: seat.branchId,
        seatNumber: input.seatNumber.trim(),
        _id: { $ne: seat._id },
      });
      if (dup) throw ApiError.conflict('Seat number already exists in this branch');
      seat.seatNumber = input.seatNumber.trim();
    }
    if (input.floor !== undefined) seat.floor = input.floor.trim();
    if (input.zone !== undefined) seat.zone = input.zone.trim();
    if (input.seatType !== undefined) seat.seatType = input.seatType;
    if (input.notes !== undefined) seat.notes = input.notes?.trim();
    if (input.active !== undefined) seat.active = input.active;
    if (input.reservedUntil !== undefined) seat.reservedUntil = input.reservedUntil;
    if (input.status !== undefined) {
      seat.status = input.status as SeatStatus;
      if (input.status === 'AVAILABLE' && !seat.assignedStudentId) {
        seat.occupied = false;
      }
    }

    await seat.save();
    return toJSON(projectSeatForUser(user, seat.toObject() as unknown as Record<string, unknown>));
  }

  async deleteSeat(user: AuthenticatedUser, seatId: string) {
    if (!user.permissions.includes(PERMISSIONS.SEAT_DELETE)) {
      throw ApiError.forbidden('Insufficient permissions to delete seats');
    }

    const seat = await SeatModel.findById(seatId);
    if (!seat) throw ApiError.notFound('Seat not found');
    await assertSeatRowRead(user, seat);
    if (seat.assignedStudentId) {
      throw ApiError.badRequest('Unassign the seat before deleting it');
    }

    await SeatModel.deleteOne({ _id: seat._id });
    return { id: String(seat._id), deleted: true };
  }

  async getSeatById(user: AuthenticatedUser, seatId: string) {
    if (!canAccessSeatList(user)) throw ApiError.forbidden('Insufficient permissions');

    const seat = await SeatModel.findById(seatId).lean();
    if (!seat) throw ApiError.notFound('Seat not found');
    await assertSeatRowRead(user, seat);
    const projected = projectSeatForUser(user, seat as unknown as Record<string, unknown>);
    const [enriched] = await enrichRowsWithLookups([projected as Record<string, unknown>], {
      branchIdKey: 'branchId',
      studentIdKey: 'assignedStudentId',
    });
    return toJSON(enriched);
  }

  async listSeats(user: AuthenticatedUser, query: ListSeatsQuery) {
    if (!canAccessSeatList(user)) throw ApiError.forbidden('Insufficient permissions');

    const { filter: scopeFilter } = applyListScope(user, query);

    if (user.role === ROLES.LIBRARY_OWNER && query.branchId) {
      await assertBranchInTenant(query.branchId, requireLibraryContext(user));
    }

    const filter: Record<string, unknown> = { ...scopeFilter };

    if (query.floor) filter.floor = query.floor;
    if (query.zone) filter.zone = query.zone;
    if (query.shiftType) filter.shiftType = query.shiftType;
    if (query.shiftId) {
      const { SeatAssignmentModel } = await import('./seat-assignment.model');
      const { SHIFT_ASSIGNMENT_STATUS } = await import('@modules/shifts/shift.constants');
      const seatIds = await SeatAssignmentModel.distinct('seatId', {
        shiftId: new Types.ObjectId(query.shiftId),
        status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
        ...scopeFilter,
      });
      filter._id = { $in: seatIds };
    }
    if (query.seatType) filter.seatType = query.seatType;
    if (query.status) filter.status = query.status;
    if (query.occupied === true) filter.occupied = true;
    if (query.occupied === false) filter.occupied = false;
    if (query.active === true) filter.active = true;
    if (query.active === false) filter.active = false;

    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ seatNumber: rx }, { zone: rx }, { floor: rx }, { notes: rx }];
    }

    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [raw, total] = await Promise.all([
      SeatModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      SeatModel.countDocuments(filter),
    ]);

    const items = raw.map((s) => projectSeatForUser(user, s as unknown as Record<string, unknown>));
    const enriched = await enrichRowsWithLookups(items as Record<string, unknown>[], {
      branchIdKey: 'branchId',
      studentIdKey: 'assignedStudentId',
    });
    const withShifts = await enrichSeatsWithShiftAssignments(enriched as Record<string, unknown>[]);

    return {
      items: withShifts.map((i) => toJSON(i)),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async assignSeatToStudent(user: AuthenticatedUser, seatId: string, input: AssignSeatInput) {
    if (!user.permissions.includes(PERMISSIONS.SEAT_ASSIGN)) {
      throw ApiError.forbidden('Insufficient permissions to assign seats');
    }

    const [seat, student] = await Promise.all([
      SeatModel.findById(seatId),
      StudentModel.findById(input.studentId),
    ]);
    if (!seat) throw ApiError.notFound('Seat not found');
    if (!student) throw ApiError.notFound('Student not found');
    await assertSeatRowRead(user, seat);
    await assertSeatRowRead(user, {
      libraryId: student.libraryId,
      branchId: student.branchId,
    } as { libraryId: unknown; branchId: unknown });

    if (String(student.branchId) !== String(seat.branchId)) {
      throw ApiError.badRequest('Student must belong to the same branch as the seat');
    }

    assertAssignableSeat(seat, { shiftBased: true });

    const startDate = student.membershipStartDate ? new Date(student.membershipStartDate) : new Date();
    const endDate = student.membershipEndDate ? new Date(student.membershipEndDate) : null;

    await createSeatAssignment({
      user,
      seat,
      studentId: student._id as Types.ObjectId,
      shiftId: new Types.ObjectId(input.shiftId),
      startDate,
      endDate,
    });

    const out = await SeatModel.findById(seat._id).lean();
    return toJSON(projectSeatForUser(user, out as unknown as Record<string, unknown>));
  }

  async unassignSeat(user: AuthenticatedUser, seatId: string) {
    if (!user.permissions.includes(PERMISSIONS.SEAT_UNASSIGN)) {
      throw ApiError.forbidden('Insufficient permissions to unassign seats');
    }

    const seat = await SeatModel.findById(seatId);
    if (!seat) throw ApiError.notFound('Seat not found');
    await assertSeatRowRead(user, seat);

    await cancelAllSeatAssignments(seat._id as Types.ObjectId);

    const linkedStudents = await StudentModel.find({ assignedSeatId: seat._id });
    for (const student of linkedStudents) {
      student.assignedSeatId = null;
      await student.save();
    }

    seat.assignedStudentId = null;
    await syncSeatOccupancyFlags(seat);

    const out = await SeatModel.findById(seat._id).lean();
    return toJSON(projectSeatForUser(user, out as unknown as Record<string, unknown>));
  }

  async bulkCreateSeats(user: AuthenticatedUser, input: BulkCreateSeatsInput) {
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      !user.permissions.includes(PERMISSIONS.SEAT_BULK_CREATE)
    ) {
      throw ApiError.forbidden('Insufficient permissions for bulk seat creation');
    }

    if (user.role !== ROLES.SUPER_ADMIN) {
      const lib = requireLibraryContext(user);
      if (String(input.libraryId) !== lib) throw ApiError.forbidden('libraryId must be your tenant library');
      if (user.role === ROLES.MANAGER || user.role === ROLES.RECEPTIONIST) {
        if (!user.branchId || String(input.branchId) !== user.branchId) {
          throw ApiError.forbidden('branchId must be your assigned branch');
        }
      }
    }

    await assertBranchInTenant(input.branchId, input.libraryId);

    const libraryId = new Types.ObjectId(input.libraryId);
    const branchId = new Types.ObjectId(input.branchId);
    type BulkDoc = {
      libraryId: Types.ObjectId;
      branchId: Types.ObjectId;
      seatNumber: string;
      floor: string;
      zone: string;
      seatType: SeatType;
      assignedStudentId: null;
      occupied: boolean;
      active: boolean;
      status: SeatStatus;
      reservedUntil: null;
    };
    const docs: BulkDoc[] = [];

    const bulkCount = input.endNumber - input.startNumber + 1;
    if (bulkCount < 1) throw ApiError.badRequest('Invalid seat number range');

    await subscriptionLimitService.validateLimitBeforeCreate(PLAN_LIMIT_ENTITY.SEATS, String(input.libraryId), {
      increment: bulkCount,
      actorUserId: user.id,
    });

    for (let n = input.startNumber; n <= input.endNumber; n += 1) {
      const numStr =
        input.padLength && input.padLength > 0 ? String(n).padStart(input.padLength, '0') : String(n);
      const seatNumber = `${input.prefix ?? ''}${numStr}`;
      docs.push({
        libraryId,
        branchId,
        seatNumber,
        floor: input.floor.trim(),
        zone: input.zone.trim(),
        seatType: input.seatType,
        assignedStudentId: null,
        occupied: false,
        active: true,
        status: 'AVAILABLE' as SeatStatus,
        reservedUntil: null,
      });
    }

    try {
      const created = await SeatModel.insertMany(docs, { ordered: false });
      return {
        createdCount: created.length,
        items: created.map((c) => toJSON(projectSeatForUser(user, c.toObject() as unknown as Record<string, unknown>))),
      };
    } catch (err: unknown) {
      const e = err as { writeErrors?: { errmsg?: string }[]; insertedIds?: unknown };
      if (e.writeErrors?.length && Object.keys(e.insertedIds ?? {}).length) {
        throw ApiError.conflict('Some seats already exist; bulk operation partially failed');
      }
      throw err;
    }
  }

  async occupancySummary(user: AuthenticatedUser, query: OccupancySummaryQuery) {
    if (
      !user.permissions.includes(PERMISSIONS.SEAT_OCCUPANCY_READ) &&
      !hasFullSeatRead(user)
    ) {
      throw ApiError.forbidden('Insufficient permissions');
    }

    const baseFilter: Record<string, unknown> = {};
    if (user.role === ROLES.SUPER_ADMIN) {
      if (query.libraryId) baseFilter.libraryId = new Types.ObjectId(query.libraryId);
      if (query.branchId) baseFilter.branchId = new Types.ObjectId(query.branchId);
    } else {
      const lib = requireLibraryContext(user);
      baseFilter.libraryId = new Types.ObjectId(lib);
      if (user.branchId) {
        baseFilter.branchId = new Types.ObjectId(user.branchId);
      } else if (query.branchId) {
        await assertBranchInTenant(query.branchId, lib);
        baseFilter.branchId = new Types.ObjectId(query.branchId);
      }
    }

    const pipeline = [
      { $match: baseFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const byStatusRaw = await SeatModel.aggregate<{ _id: string; count: number }>(pipeline);

    const byStatus: Record<string, number> = {};
    for (const s of SEAT_STATUSES) byStatus[s] = 0;
    for (const row of byStatusRaw) {
      if (row._id) byStatus[row._id] = row.count;
    }

    const [total, occupiedCount, availableAssignable] = await Promise.all([
      SeatModel.countDocuments(baseFilter),
      SeatModel.countDocuments({ ...baseFilter, occupied: true }),
      SeatModel.countDocuments({
        ...baseFilter,
        occupied: false,
        active: true,
        status: { $in: ['AVAILABLE'] },
      }),
    ]);

    const activeStatuses = [
      SHIFT_ASSIGNMENT_STATUS.ACTIVE,
      SHIFT_ASSIGNMENT_STATUS.RESERVED,
    ];
    const assignmentMatch: Record<string, unknown> = { status: { $in: activeStatuses } };
    if (baseFilter.libraryId) assignmentMatch.libraryId = baseFilter.libraryId;
    if (baseFilter.branchId) assignmentMatch.branchId = baseFilter.branchId;

    const [occupiedByShift, perSeatCounts, shiftCount] = await Promise.all([
      SeatAssignmentModel.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: assignmentMatch },
        { $group: { _id: '$shiftId', count: { $sum: 1 } } },
      ]),
      SeatAssignmentModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { ...assignmentMatch, status: SHIFT_ASSIGNMENT_STATUS.ACTIVE } },
        { $group: { _id: '$seatId', n: { $sum: 1 } } },
      ]),
      baseFilter.branchId
        ? ShiftModel.countDocuments({ branchId: baseFilter.branchId, active: true })
        : Promise.resolve(0),
    ]);

    const partialSeatCount =
      shiftCount > 0
        ? perSeatCounts.filter((r) => r.n > 0 && r.n < shiftCount).length
        : perSeatCounts.filter((r) => r.n > 0).length;
    const fullUtilSeatCount =
      shiftCount > 0 ? perSeatCounts.filter((r) => r.n >= shiftCount).length : 0;

    const shiftDocs = baseFilter.branchId
      ? await ShiftModel.find({ branchId: baseFilter.branchId, active: true })
          .select('name')
          .lean()
      : [];
    const shiftNameById = new Map(shiftDocs.map((s) => [String(s._id), s.name]));

    return {
      total,
      occupied: occupiedCount,
      availableAssignable,
      byStatus,
      partialSeats: partialSeatCount,
      fullyUtilizedSeats: fullUtilSeatCount,
      occupiedByShift: occupiedByShift.map((row) => ({
        shiftId: String(row._id),
        shiftName: shiftNameById.get(String(row._id)) ?? 'Shift',
        occupied: row.count,
      })),
    };
  }

  async listAvailableSeats(user: AuthenticatedUser, query: ListSeatsQuery) {
    return this.listSeats(user, {
      ...query,
      occupied: false,
      status: 'AVAILABLE',
    });
  }

  async listReservedSeats(user: AuthenticatedUser, query: ListSeatsQuery) {
    if (!canAccessSeatList(user)) throw ApiError.forbidden('Insufficient permissions');
    const { filter: scopeFilter } = applyListScope(user, query);
    if (user.role === ROLES.LIBRARY_OWNER && query.branchId) {
      await assertBranchInTenant(query.branchId, requireLibraryContext(user));
    }

    const filter: Record<string, unknown> = {
      ...scopeFilter,
      $or: [{ status: 'RESERVED' }, { reservedUntil: { $ne: null } }],
    };

    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const [raw, total] = await Promise.all([
      SeatModel.find(filter)
        .sort({ reservedUntil: -1, seatNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SeatModel.countDocuments(filter),
    ]);

    const items = raw.map((s) => toJSON(projectSeatForUser(user, s as unknown as Record<string, unknown>)));
    return {
      items,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  /**
   * Release all active seat assignments for a student and free legacy seat fields.
   * Returns details for each released assignment (empty when nothing was active).
   */
  async releaseAllSeatsForStudent(
    studentId: string,
    options?: ReleaseStudentSeatsOptions,
  ): Promise<ReleasedSeatInfo[]> {
    const sid = new Types.ObjectId(studentId);
    const active = [SHIFT_ASSIGNMENT_STATUS.ACTIVE, SHIFT_ASSIGNMENT_STATUS.RESERVED];
    const now = new Date();
    const reason = options?.reason ?? 'Student seat released';
    const assignmentStatus = options?.assignmentStatus ?? SHIFT_ASSIGNMENT_STATUS.CANCELLED;

    const assignments = await SeatAssignmentModel.find({
      studentId: sid,
      status: { $in: active },
    })
      .populate<{ seatId: { _id: Types.ObjectId; seatNumber?: string | number } | null }>(
        'seatId',
        'seatNumber',
      )
      .populate<{ shiftId: { _id: Types.ObjectId; name?: string } | null }>('shiftId', 'name')
      .lean();

    if (!assignments.length) {
      const student = await StudentModel.findById(sid);
      if (student && (student.assignedSeatId || student.currentShiftId)) {
        student.assignedSeatId = null;
        student.currentShiftId = null;
        await student.save();
      }
      return [];
    }

    const seatIds = [
      ...new Set(
        assignments.map((a) => {
          const raw = a.seatId as Types.ObjectId | { _id: Types.ObjectId } | null;
          if (raw && typeof raw === 'object' && '_id' in raw) {
            return String(raw._id);
          }
          return String(raw);
        }),
      ),
    ];

    await SeatAssignmentModel.updateMany(
      { studentId: sid, status: { $in: active } },
      {
        $set: {
          status: assignmentStatus,
          endDate: now,
          endedAt: now,
          releasedReason: reason,
        },
      },
    );

    await SeatModel.updateMany(
      { assignedStudentId: sid },
      {
        $set: {
          assignedStudentId: null,
          occupied: false,
          status: 'AVAILABLE' as SeatStatus,
        },
      },
    );

    for (const seatId of seatIds) {
      const seat = await SeatModel.findById(seatId);
      if (seat) await syncSeatOccupancyFlags(seat);
    }

    const student = await StudentModel.findById(sid);
    if (student) {
      student.assignedSeatId = null;
      student.currentShiftId = null;
      await student.save();
    }

    return assignments.map((row) => {
      const seatDoc = row.seatId as { _id: Types.ObjectId; seatNumber?: string | number } | null;
      const shiftDoc = row.shiftId as { _id: Types.ObjectId; name?: string } | null;
      return {
        seatId: String(seatDoc?._id ?? row.seatId),
        seatNumber: seatDoc?.seatNumber != null ? String(seatDoc.seatNumber) : '—',
        shiftId: String(shiftDoc?._id ?? row.shiftId),
        shiftName: shiftDoc?.name ?? null,
      };
    });
  }

  /** Clear a seat after transfer when we know the prior seat id + student. */
  async vacateSeatIfAssignedToStudent(seatId: string, studentId: string) {
    const sid = new Types.ObjectId(studentId);
    const seatOid = new Types.ObjectId(seatId);

    await SeatAssignmentModel.updateMany(
      {
        seatId: seatOid,
        studentId: sid,
        status: { $in: [SHIFT_ASSIGNMENT_STATUS.ACTIVE, SHIFT_ASSIGNMENT_STATUS.RESERVED] },
      },
      { $set: { status: SHIFT_ASSIGNMENT_STATUS.CANCELLED } },
    );

    await SeatModel.updateOne(
      { _id: seatOid, assignedStudentId: sid },
      {
        $set: {
          assignedStudentId: null,
          occupied: false,
          status: 'AVAILABLE' as SeatStatus,
        },
      },
    );

    const seat = await SeatModel.findById(seatOid);
    if (seat) await syncSeatOccupancyFlags(seat);
  }

  /**
   * Keep SeatAssignment + Student rows in sync when student seat fields change.
   */
  async syncAfterStudentSeatChange(
    user: AuthenticatedUser,
    studentId: string,
    previousSeatId: string | null,
    nextSeatId: string | null,
    shiftId?: string | null,
  ) {
    const student = await StudentModel.findById(studentId);
    if (!student) return;

    const active = [SHIFT_ASSIGNMENT_STATUS.ACTIVE, SHIFT_ASSIGNMENT_STATUS.RESERVED];

    if (previousSeatId && previousSeatId !== nextSeatId) {
      await SeatAssignmentModel.updateMany(
        {
          studentId: student._id,
          seatId: new Types.ObjectId(previousSeatId),
          status: { $in: active },
        },
        { $set: { status: SHIFT_ASSIGNMENT_STATUS.CANCELLED } },
      );
      const prevSeat = await SeatModel.findById(previousSeatId);
      if (prevSeat) await syncSeatOccupancyFlags(prevSeat);
    }

    if (!nextSeatId) {
      await SeatAssignmentModel.updateMany(
        { studentId: student._id, status: { $in: active } },
        { $set: { status: SHIFT_ASSIGNMENT_STATUS.CANCELLED } },
      );
      return;
    }

    const seat = await SeatModel.findById(nextSeatId);
    if (!seat) throw ApiError.notFound('Seat not found');
    if (String(student.branchId) !== String(seat.branchId)) {
      throw ApiError.badRequest('Seat must belong to the same branch as the student');
    }
    try {
      assertAssignableSeat(seat, { shiftBased: true });
    } catch {
      throw ApiError.badRequest('Seat cannot be assigned (blocked, maintenance, or reserved)');
    }

    let resolvedShiftId: Types.ObjectId;
    try {
      resolvedShiftId = await resolveShiftIdForStudentSeatAssignment(seat, shiftId);
    } catch {
      throw ApiError.badRequest(
        'shiftId is required. Select a shift or create branch shifts first.',
      );
    }

    if (previousSeatId === nextSeatId) {
      const unchanged = await SeatAssignmentModel.findOne({
        studentId: student._id,
        seatId: seat._id,
        shiftId: resolvedShiftId,
        status: { $in: active },
      }).lean();
      if (unchanged) return;
    }

    const startDate = student.membershipStartDate
      ? new Date(student.membershipStartDate)
      : new Date();
    const endDate = student.membershipEndDate ? new Date(student.membershipEndDate) : null;

    await createSeatAssignment({
      user,
      seat,
      studentId: student._id as Types.ObjectId,
      shiftId: resolvedShiftId,
      startDate,
      endDate,
    });
  }
}

export const seatService = new SeatService();

export const __seatTestables = {
  assertBranchInTenant,
  hasFullSeatRead,
  canAccessSeatList,
  applyListScope,
};
