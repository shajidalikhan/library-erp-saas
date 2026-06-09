import { Types } from 'mongoose';

import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';
import { isFullDayShift, shiftsTimeOverlap } from '@modules/seats/seat-occupancy.conflicts';
import { PUBLIC_SEAT_CELL_STATUS, type PublicSeatCellStatus } from './public-booking.constants';

type ShiftLike = {
  _id: Types.ObjectId | string;
  branchId: Types.ObjectId | string;
  type: string;
  startTime: string;
  endTime: string;
};

type SeatLike = {
  _id: Types.ObjectId | string;
  branchId: Types.ObjectId | string;
  status: string;
  active?: boolean;
};

type AssignmentLike = {
  seatId: Types.ObjectId | string;
  shiftId: unknown;
};

type PublicBookingLike = {
  seatId: Types.ObjectId | string;
  shiftId: Types.ObjectId | string;
};

export function resolvePublicSeatCellStatus(
  seat: SeatLike,
  shift: ShiftLike,
  assignmentRows: AssignmentLike[],
  publicBlockedOnShift: boolean,
): PublicSeatCellStatus {
  if (seat.status === 'BLOCKED' || seat.status === 'MAINTENANCE' || seat.active === false) {
    return PUBLIC_SEAT_CELL_STATUS.BLOCKED;
  }
  if (publicBlockedOnShift) return PUBLIC_SEAT_CELL_STATUS.RESERVED;

  const conflict = assignmentRows.some((row) => {
    const existingShift = row.shiftId as {
      _id?: Types.ObjectId | string;
      type?: string;
      startTime?: string;
      endTime?: string;
    } | null;
    if (!existingShift?._id) return false;
    if (String(existingShift._id) === String(shift._id)) return true;
    if (isFullDayShift(existingShift) || isFullDayShift({ type: shift.type })) return true;
    return shiftsTimeOverlap(
      { startTime: String(existingShift.startTime), endTime: String(existingShift.endTime) },
      { startTime: shift.startTime, endTime: shift.endTime },
    );
  });

  if (conflict || seat.status === 'OCCUPIED') return PUBLIC_SEAT_CELL_STATUS.OCCUPIED;
  if (seat.status === 'RESERVED') return PUBLIC_SEAT_CELL_STATUS.RESERVED;
  return PUBLIC_SEAT_CELL_STATUS.AVAILABLE;
}

export function buildPublicAvailabilityForShift(input: {
  shift: ShiftLike;
  seats: SeatLike[];
  assignments: AssignmentLike[];
  publicBookings: PublicBookingLike[];
}): { seats: Array<{ status: PublicSeatCellStatus }>; availableCount: number } {
  const shiftId = String(input.shift._id);
  const branchId = String(input.shift.branchId);
  const branchSeats = input.seats.filter((s) => String(s.branchId) === branchId && s.active !== false);
  const publicBlocked = new Set(
    input.publicBookings
      .filter((b) => String(b.shiftId) === shiftId)
      .map((b) => String(b.seatId)),
  );

  let availableCount = 0;
  const seats = branchSeats.map((seat) => {
    const assignmentRows = input.assignments.filter((a) => String(a.seatId) === String(seat._id));
    const status = resolvePublicSeatCellStatus(
      seat,
      input.shift,
      assignmentRows,
      publicBlocked.has(String(seat._id)),
    );
    if (status === PUBLIC_SEAT_CELL_STATUS.AVAILABLE) availableCount += 1;
    return { status };
  });

  return { seats, availableCount };
}

export function toPublicSeatStatus(
  status: PublicSeatCellStatus,
  showFullSeatBreakdown: boolean,
): PublicSeatCellStatus {
  if (showFullSeatBreakdown) return status;
  return status === PUBLIC_SEAT_CELL_STATUS.AVAILABLE
    ? PUBLIC_SEAT_CELL_STATUS.AVAILABLE
    : PUBLIC_SEAT_CELL_STATUS.NOT_AVAILABLE;
}
