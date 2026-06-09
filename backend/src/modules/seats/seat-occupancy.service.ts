import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { mediaUrlFromField } from '@utils/media-asset.schema';
import { BranchModel } from '@modules/library/library.models';
import { ShiftModel } from '@modules/shifts/shift.model';
import {
  OCCUPANCY_CELL_STATE,
  SHIFT_ASSIGNMENT_STATUS,
  type OccupancyCellState,
} from '@modules/shifts/shift.constants';

import {
  buildPublicHoldMap,
  loadActivePublicHoldsForBranch,
  publicHoldKey,
  toPublicHoldSummary,
  type PublicHoldSummary,
} from '@modules/bookings/public-booking-holds.util';

import { SeatModel } from './seat.model';
import { SeatAssignmentModel } from './seat-assignment.model';
import {
  cellBlockedReason,
  type ShiftTimingInput,
} from './seat-occupancy.conflicts';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

const ACTIVE_STATUSES = [
  SHIFT_ASSIGNMENT_STATUS.ACTIVE,
  SHIFT_ASSIGNMENT_STATUS.RESERVED,
] as const;

function assertBranchAccess(user: AuthenticatedUser, branchId: string, libraryId: string): void {
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (!user.libraryId || user.libraryId !== libraryId) {
    throw ApiError.forbidden('You do not have access to this branch');
  }
  if (user.branchId && user.branchId !== branchId) {
    throw ApiError.forbidden('You do not have access to this branch');
  }
}

function studentSummary(student: Record<string, unknown> | null | undefined) {
  if (!student || typeof student !== 'object') return null;
  return {
    fullName: student.fullName,
    studentCode: student.studentId,
    phone: student.phone ?? null,
    profilePhotoUrl: mediaUrlFromField(student.profilePhoto),
    membershipEndDate: student.membershipEndDate ?? null,
  };
}

class SeatOccupancyService {
  async getGrid(
    user: AuthenticatedUser,
    query: { branchId: string; floor?: string; zone?: string },
  ) {
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      !user.permissions.includes(PERMISSIONS.SEAT_READ) &&
      !user.permissions.includes(PERMISSIONS.SEAT_OCCUPANCY_READ)
    ) {
      throw ApiError.forbidden('Insufficient permissions');
    }

    const branch = await BranchModel.findById(query.branchId).lean();
    if (!branch) throw ApiError.notFound('Branch not found');
    assertBranchAccess(user, String(branch._id), String(branch.libraryId));

    const seatFilter: Record<string, unknown> = {
      branchId: branch._id,
      active: true,
    };
    if (query.floor) seatFilter.floor = query.floor;
    if (query.zone) seatFilter.zone = query.zone;

    const libraryId = branch.libraryId as Types.ObjectId;
    const [seats, shifts, assignments, publicHolds] = await Promise.all([
      SeatModel.find(seatFilter).sort({ seatNumber: 1 }).lean(),
      ShiftModel.find({ branchId: branch._id, active: true }).sort({ startTime: 1 }).lean(),
      SeatAssignmentModel.find({
        branchId: branch._id,
        status: { $in: [...ACTIVE_STATUSES] },
      })
        .populate('studentId', 'fullName studentId phone profilePhoto membershipEndDate')
        .populate('shiftId', 'name startTime endTime type color')
        .lean(),
      loadActivePublicHoldsForBranch(branch._id as Types.ObjectId, libraryId),
    ]);

    const publicHoldByCell = buildPublicHoldMap(publicHolds);

    const assignmentsBySeat = new Map<string, typeof assignments>();
    for (const a of assignments) {
      const key = String(a.seatId);
      if (!assignmentsBySeat.has(key)) assignmentsBySeat.set(key, []);
      assignmentsBySeat.get(key)!.push(a);
    }

    const cells: Record<
      string,
      Record<
        string,
        {
          state: OccupancyCellState;
          assignmentId?: string;
          student?: ReturnType<typeof studentSummary>;
          conflictReason?: string | null;
          availabilityHint?: string | null;
          publicHold?: PublicHoldSummary | null;
        }
      >
    > = {};

    let occupiedCells = 0;
    let availableCells = 0;
    let blockedCells = 0;

    for (const shift of shifts) {
      const shiftKey = String(shift._id);
      cells[shiftKey] = {};
      const shiftTiming: ShiftTimingInput = {
        _id: shift._id as Types.ObjectId,
        type: shift.type,
        startTime: shift.startTime,
        endTime: shift.endTime,
      };

      for (const seat of seats) {
        const seatKey = String(seat._id);
        const seatAssignments = assignmentsBySeat.get(seatKey) ?? [];

        if (seat.status === 'BLOCKED' || seat.status === 'MAINTENANCE' || !seat.active) {
          cells[shiftKey][seatKey] = {
            state: OCCUPANCY_CELL_STATE.BLOCKED,
            conflictReason: `Seat is ${seat.status?.toLowerCase() ?? 'unavailable'}`,
          };
          blockedCells += 1;
          continue;
        }

        const onShift = seatAssignments.find((a) => String(a.shiftId?._id ?? a.shiftId) === shiftKey);

        if (onShift) {
          const st =
            onShift.status === SHIFT_ASSIGNMENT_STATUS.RESERVED
              ? OCCUPANCY_CELL_STATE.RESERVED
              : OCCUPANCY_CELL_STATE.OCCUPIED;
          cells[shiftKey][seatKey] = {
            state: st,
            assignmentId: String(onShift._id),
            student: studentSummary(onShift.studentId as unknown as Record<string, unknown>),
          };
          occupiedCells += 1;
          continue;
        }

        const others = seatAssignments.map((a) => ({
          shiftId: a.shiftId as unknown as ShiftTimingInput,
        }));
        const hold = publicHoldByCell.get(publicHoldKey(seatKey, shiftKey));
        if (hold) {
          cells[shiftKey][seatKey] = {
            state: OCCUPANCY_CELL_STATE.PUBLIC_HOLD,
            publicHold: hold,
            availabilityHint: `Public hold until ${hold.expiresAt ? new Date(hold.expiresAt).toLocaleString() : '—'}`,
          };
          occupiedCells += 1;
          continue;
        }

        const blockReason = cellBlockedReason(shiftTiming, others);

        if (blockReason) {
          cells[shiftKey][seatKey] = {
            state: OCCUPANCY_CELL_STATE.BLOCKED,
            conflictReason: blockReason,
            availabilityHint: blockReason,
          };
          blockedCells += 1;
          continue;
        }

        cells[shiftKey][seatKey] = {
          state: OCCUPANCY_CELL_STATE.AVAILABLE,
          availabilityHint: `${shift.name} shift available`,
        };
        availableCells += 1;
      }
    }

    const seatIdsWithAssignments = new Set(assignments.map((a) => String(a.seatId)));
    const fullyUtilizedSeats = seats.filter((s) => {
      const seatKey = String(s._id);
      if (!seatIdsWithAssignments.has(seatKey)) return false;
      const count = assignmentsBySeat.get(seatKey)?.length ?? 0;
      return count >= shifts.length;
    }).length;

    const partialSeats = seats.filter((s) => {
      const count = assignmentsBySeat.get(String(s._id))?.length ?? 0;
      return count > 0 && count < shifts.length;
    }).length;

    const vacantSeats = seats.filter((s) => !assignmentsBySeat.has(String(s._id))).length;

    return {
      branch: toJSON(branch),
      shifts: shifts.map((s) => toJSON(s)),
      seats: seats.map((s) => ({
        _id: s._id,
        seatNumber: s.seatNumber,
        floor: s.floor,
        zone: s.zone,
        seatType: s.seatType,
        status: s.status,
        active: s.active,
        occupied: s.occupied,
      })),
      cells,
      summary: {
        totalSeats: seats.length,
        totalShifts: shifts.length,
        occupiedCells,
        availableCells,
        blockedCells,
        vacantSeats,
        partialSeats,
        fullyUtilizedSeats,
        occupiedByShift: shifts.map((sh) => ({
          shiftId: String(sh._id),
          shiftName: sh.name,
          occupied: assignments.filter(
            (a) => String(a.shiftId?._id ?? a.shiftId) === String(sh._id),
          ).length,
        })),
      },
    };
  }

  async getSeatOccupancy(user: AuthenticatedUser, seatId: string) {
    const seat = await SeatModel.findById(seatId).lean();
    if (!seat) throw ApiError.notFound('Seat not found');
    assertBranchAccess(user, String(seat.branchId), String(seat.libraryId));

    const [branch, shifts, assignments, publicHolds] = await Promise.all([
      BranchModel.findById(seat.branchId).lean(),
      ShiftModel.find({ branchId: seat.branchId, active: true }).sort({ startTime: 1 }).lean(),
      SeatAssignmentModel.find({
        seatId: seat._id,
        status: { $in: [...ACTIVE_STATUSES] },
      })
        .populate('studentId', 'fullName studentId phone profilePhoto membershipEndDate')
        .populate('shiftId', 'name startTime endTime type color')
        .lean(),
      loadActivePublicHoldsForBranch(
        seat.branchId as Types.ObjectId,
        seat.libraryId as Types.ObjectId,
      ),
    ]);

    const publicHoldByShift = new Map(
      publicHolds.map((h) => [String(h.shiftId), toPublicHoldSummary(h)]),
    );

    return {
      seat: toJSON(seat),
      branch: branch ? toJSON(branch) : null,
      shifts: shifts.map((s) => toJSON(s)),
      publicHolds: [...publicHoldByShift.entries()].map(([shiftId, hold]) => ({ shiftId, hold })),
      assignments: assignments.map((a) => {
        const raw = toJSON(a) as Record<string, unknown>;
        return {
          ...raw,
          student: studentSummary(a.studentId as unknown as Record<string, unknown>),
        };
      }),
    };
  }
}

export const seatOccupancyService = new SeatOccupancyService();
