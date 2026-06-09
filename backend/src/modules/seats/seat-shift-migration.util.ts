import { Types } from 'mongoose';

import type { ShiftKind } from '@modules/shifts/shift.constants';
import { ShiftModel } from '@modules/shifts/shift.model';
import type { ShiftType } from './seat.constants';
import type { ISeatDocument } from './seat.model';
import { SeatModel } from './seat.model';

/** Legacy seat.shiftType → branch Shift.type */
const LEGACY_SHIFT_MAP: Record<ShiftType, ShiftKind> = {
  MORNING: 'MORNING',
  EVENING: 'EVENING',
  NIGHT: 'NIGHT',
  FULL_DAY: 'FULL_DAY',
};

export async function resolveShiftIdForLegacySeat(
  seat: Pick<ISeatDocument, '_id' | 'branchId' | 'libraryId'>,
): Promise<Types.ObjectId | null> {
  const withLegacy = await SeatModel.findById(seat._id).select('+shiftType').lean();
  const legacyType = withLegacy?.shiftType as ShiftType | undefined;
  if (!legacyType) return null;

  const mapped = LEGACY_SHIFT_MAP[legacyType];
  const shift = await ShiftModel.findOne({
    branchId: seat.branchId,
    libraryId: seat.libraryId,
    type: mapped,
    active: true,
  })
    .sort({ createdAt: 1 })
    .select('_id')
    .lean();

  return shift?._id ? (shift._id as Types.ObjectId) : null;
}

export async function resolveShiftIdForStudentSeatAssignment(
  seat: Pick<ISeatDocument, '_id' | 'branchId' | 'libraryId'>,
  shiftId?: string | null,
): Promise<Types.ObjectId> {
  if (shiftId) return new Types.ObjectId(shiftId);

  const fromLegacy = await resolveShiftIdForLegacySeat(seat);
  if (fromLegacy) return fromLegacy;

  const fallback = await ShiftModel.findOne({
    branchId: seat.branchId,
    libraryId: seat.libraryId,
    active: true,
  })
    .sort({ startTime: 1 })
    .select('_id')
    .lean();

  if (fallback?._id) return fallback._id as Types.ObjectId;

  throw new Error('No active shift found for this branch. Create a shift or provide shiftId.');
}
