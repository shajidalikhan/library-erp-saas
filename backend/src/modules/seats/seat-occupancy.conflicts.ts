import { Types } from 'mongoose';

import { ApiError } from '@utils/ApiError';
import type { ShiftKind } from '@modules/shifts/shift.constants';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

import { assertNoActivePublicHoldOnShift } from '@modules/bookings/public-booking-holds.util';

import { SeatAssignmentModel } from './seat-assignment.model';

export interface ShiftTimingInput {
  _id: Types.ObjectId;
  type: ShiftKind | string;
  startTime: string;
  endTime: string;
}

const ACTIVE_STATUSES = [
  SHIFT_ASSIGNMENT_STATUS.ACTIVE,
  SHIFT_ASSIGNMENT_STATUS.RESERVED,
] as const;

export function isFullDayShift(shift: { type?: string }): boolean {
  return shift.type === 'FULL_DAY';
}

/** Parse HH:mm to minutes from midnight (0–1439). */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map((p) => Number.parseInt(p, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** One or two intervals for same-day or overnight shifts. */
export function shiftToIntervals(startTime: string, endTime: string): Array<[number, number]> {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start < end) return [[start, end]];
  if (start === end) return [[0, 1440]];
  return [
    [start, 1440],
    [0, end],
  ];
}

export function intervalsOverlap(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): boolean {
  for (const [as, ae] of a) {
    for (const [bs, be] of b) {
      if (as < be && bs < ae) return true;
    }
  }
  return false;
}

export function shiftsTimeOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  return intervalsOverlap(shiftToIntervals(a.startTime, a.endTime), shiftToIntervals(b.startTime, b.endTime));
}

export function describeShiftConflict(
  incoming: ShiftTimingInput,
  existing: ShiftTimingInput,
): string {
  if (isFullDayShift(incoming) || isFullDayShift(existing)) {
    if (isFullDayShift(incoming)) {
      return 'Blocked by full-day assignment on this seat';
    }
    return 'Cannot assign: seat has a full-day assignment';
  }
  if (String(incoming._id) === String(existing._id)) {
    return 'This seat already has an active student for the selected shift';
  }
  if (shiftsTimeOverlap(incoming, existing)) {
    return 'Shift timings overlap with an existing assignment on this seat';
  }
  return 'Assignment conflict on this seat';
}

/**
 * Validates a new/updated assignment against active seat occupancy rules.
 */
export type SeatAssignmentConflictOptions = {
  excludeAssignmentId?: Types.ObjectId;
  excludeStudentId?: Types.ObjectId;
};

export async function assertSeatAssignmentAllowed(
  seatId: Types.ObjectId,
  incomingShift: ShiftTimingInput,
  options?: SeatAssignmentConflictOptions | Types.ObjectId,
): Promise<void> {
  const resolved: SeatAssignmentConflictOptions =
    options instanceof Types.ObjectId ? { excludeAssignmentId: options } : options ?? {};

  const filter: Record<string, unknown> = {
    seatId,
    status: { $in: [...ACTIVE_STATUSES] },
  };
  if (resolved.excludeAssignmentId) filter._id = { $ne: resolved.excludeAssignmentId };

  const existingRows = await SeatAssignmentModel.find(filter)
    .populate<{ shiftId: ShiftTimingInput }>('shiftId', 'type startTime endTime')
    .lean();

  await assertNoActivePublicHoldOnShift(seatId, incomingShift._id);

  for (const row of existingRows) {
    const existingShift = row.shiftId as unknown as ShiftTimingInput;
    if (!existingShift?._id) continue;

    if (
      resolved.excludeStudentId &&
      row.studentId &&
      String(row.studentId) === String(resolved.excludeStudentId) &&
      String(existingShift._id) === String(incomingShift._id)
    ) {
      continue;
    }

    if (String(existingShift._id) === String(incomingShift._id)) {
      throw ApiError.conflict('This seat already has an active student for the selected shift');
    }

    if (isFullDayShift(incomingShift) || isFullDayShift(existingShift)) {
      throw ApiError.conflict(describeShiftConflict(incomingShift, existingShift));
    }

    if (shiftsTimeOverlap(incomingShift, existingShift)) {
      throw ApiError.conflict(describeShiftConflict(incomingShift, existingShift));
    }
  }
}

/** For grid: why a cell cannot accept the shift (null = available). */
export function cellBlockedReason(
  incomingShift: ShiftTimingInput,
  activeAssignments: Array<{ shiftId: ShiftTimingInput }>,
): string | null {
  for (const row of activeAssignments) {
    const existing = row.shiftId;
    if (!existing?._id) continue;
    if (String(existing._id) === String(incomingShift._id)) continue;

    if (isFullDayShift(incomingShift) || isFullDayShift(existing)) {
      return describeShiftConflict(incomingShift, existing);
    }
    if (shiftsTimeOverlap(incomingShift, existing)) {
      return describeShiftConflict(incomingShift, existing);
    }
  }
  return null;
}
