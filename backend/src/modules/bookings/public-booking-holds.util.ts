import { Types } from 'mongoose';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { logActivity } from '@modules/activity/activity-audit.service';
import { SeatModel } from '@modules/seats/seat.model';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

import {
  ACTIVE_PUBLIC_HOLD_STATUSES,
  PUBLIC_BOOKING_STATUS,
} from './public-booking.constants';
import { PublicSeatBookingModel } from './public-booking.model';
const ACTIVE_ASSIGNMENT_STATUSES = [
  SHIFT_ASSIGNMENT_STATUS.ACTIVE,
  SHIFT_ASSIGNMENT_STATUS.RESERVED,
] as const;

export type PublicHoldSummary = {
  bookingId: string;
  bookingReference: string;
  fullName: string;
  phone: string;
  expiresAt: string | null;
  status: string;
  shiftName?: string;
  seatNumber?: string;
};

export function toPublicHoldSummary(doc: {
  _id: Types.ObjectId;
  bookingReference: string;
  fullName: string;
  phone: string;
  expiresAt?: Date | null;
  bookingStatus: string;
  selectedShiftName?: string;
  selectedSeatNumber?: string;
}): PublicHoldSummary {
  return {
    bookingId: String(doc._id),
    bookingReference: doc.bookingReference,
    fullName: doc.fullName,
    phone: doc.phone,
    expiresAt: doc.expiresAt ? doc.expiresAt.toISOString() : null,
    status: doc.bookingStatus,
    shiftName: doc.selectedShiftName,
    seatNumber: doc.selectedSeatNumber,
  };
}

export function activePublicHoldFilter(
  libraryId?: Types.ObjectId,
  branchId?: Types.ObjectId,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    bookingStatus: { $in: [...ACTIVE_PUBLIC_HOLD_STATUSES] },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  };
  if (libraryId) filter.libraryId = libraryId;
  if (branchId) filter.branchId = branchId;
  return filter;
}

export async function loadActivePublicHoldsForBranch(branchId: Types.ObjectId, libraryId: Types.ObjectId) {
  return PublicSeatBookingModel.find(activePublicHoldFilter(libraryId, branchId))
    .select(
      'seatId shiftId bookingReference fullName phone expiresAt bookingStatus selectedShiftName selectedSeatNumber',
    )
    .lean();
}

export function publicHoldKey(seatId: Types.ObjectId | string, shiftId: Types.ObjectId | string): string {
  return `${String(seatId)}:${String(shiftId)}`;
}

export function buildPublicHoldMap(
  holds: Array<{ seatId: Types.ObjectId; shiftId: Types.ObjectId } & Parameters<typeof toPublicHoldSummary>[0]>,
): Map<string, PublicHoldSummary> {
  const map = new Map<string, PublicHoldSummary>();
  for (const row of holds) {
    map.set(publicHoldKey(row.seatId, row.shiftId), toPublicHoldSummary(row));
  }
  return map;
}

export async function syncSeatReservationAfterHoldChange(seatId: Types.ObjectId): Promise<void> {
  const stillHeld = await PublicSeatBookingModel.exists({
    seatId,
    ...activePublicHoldFilter(),
  });
  if (stillHeld) return;

  const hasAssignment = await SeatAssignmentModel.exists({
    seatId,
    status: { $in: [...ACTIVE_ASSIGNMENT_STATUSES] },
  });
  if (hasAssignment) return;

  await SeatModel.updateOne(
    { _id: seatId, status: 'RESERVED' },
    { $set: { status: 'AVAILABLE', reservedUntil: null } },
  );
}

export function assertCanReleasePublicHold(user: AuthenticatedUser): void {
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.LIBRARY_OWNER) return;
  const perms = user.permissions.map((p) => p.toLowerCase());
  const can =
    perms.includes(PERMISSIONS.BOOKING_MANAGE.toLowerCase()) ||
    perms.includes(PERMISSIONS.SEAT_ASSIGN.toLowerCase()) ||
    perms.includes(PERMISSIONS.BOOKING_UPDATE.toLowerCase());
  if (!can) {
    throw ApiError.forbidden('You do not have permission to release public booking holds');
  }
}

export async function assertNoActivePublicHoldOnShift(
  seatId: Types.ObjectId,
  shiftId: Types.ObjectId,
): Promise<void> {
  const hold = await PublicSeatBookingModel.findOne({
    seatId,
    shiftId,
    bookingStatus: PUBLIC_BOOKING_STATUS.HOLD,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  })
    .select('bookingReference expiresAt fullName')
    .lean();
  if (!hold) return;
  throw ApiError.conflict('Seat is held by a public booking', {
    code: 'PUBLIC_HOLD',
    bookingId: String(hold._id),
    bookingReference: hold.bookingReference,
    expiresAt: hold.expiresAt,
    fullName: hold.fullName,
  });
}

export async function releasePublicHoldByStaff(
  user: AuthenticatedUser,
  bookingId: string,
  note?: string,
): Promise<Record<string, unknown>> {
  assertCanReleasePublicHold(user);

  const doc = await PublicSeatBookingModel.findById(bookingId);
  if (!doc) throw ApiError.notFound('Booking not found');

  if (user.role !== ROLES.SUPER_ADMIN) {
    if (!user.libraryId || String(doc.libraryId) !== user.libraryId) {
      throw ApiError.forbidden('Access denied');
    }
    if (user.branchId && String(doc.branchId) !== user.branchId) {
      throw ApiError.forbidden('Booking not in your branch');
    }
  }

  if (
    doc.bookingStatus !== PUBLIC_BOOKING_STATUS.HOLD &&
    doc.bookingStatus !== PUBLIC_BOOKING_STATUS.APPROVED
  ) {
    throw ApiError.conflict('Only active public holds can be released');
  }

  const releaseNote = note?.trim() || 'Released by staff for internal assignment';
  doc.bookingStatus = PUBLIC_BOOKING_STATUS.RELEASED_BY_STAFF;
  doc.notes = [doc.notes, releaseNote].filter(Boolean).join('\n').trim();
  await doc.save();

  await syncSeatReservationAfterHoldChange(doc.seatId as Types.ObjectId);

  logActivity({
    actorUserId: user.id,
    action: 'public_booking.hold_released',
    entityType: 'PublicSeatBooking',
    entityId: String(doc._id),
    libraryId: String(doc.libraryId),
    branchId: String(doc.branchId),
    metadata: {
      bookingReference: doc.bookingReference,
      seatId: String(doc.seatId),
      shiftId: String(doc.shiftId),
      note: releaseNote,
    },
  });

  return JSON.parse(JSON.stringify(doc.toObject())) as Record<string, unknown>;
}
