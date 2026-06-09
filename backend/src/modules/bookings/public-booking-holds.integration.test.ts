import crypto from 'node:crypto';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { FeePlanModel } from '@modules/payments/payments.models';
import { ShiftModel } from '@modules/shifts/shift.model';
import { OCCUPANCY_CELL_STATE } from '@modules/shifts/shift.constants';
import { SeatModel } from '@modules/seats/seat.model';
import { seatOccupancyService } from '@modules/seats/seat-occupancy.service';

import { PUBLIC_BOOKING_STATUS, PUBLIC_SEAT_CELL_STATUS } from './public-booking.constants';
import { publicBookingService } from './public-booking.service';
import { assertCanReleasePublicHold } from './public-booking-holds.util';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const k of Object.keys(cols)) await cols[k].deleteMany({});
});

const owner = (libraryId: string): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Owner',
  email: 'owner@test.com',
  role: ROLES.LIBRARY_OWNER,
  permissions: ['booking.manage', 'seat.assign', 'seat.read', 'seat.occupancy.read'],
  libraryId,
  branchId: null,
  studentId: null,
  isActive: true,
});

const receptionist = (libraryId: string, branchId: string): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Desk',
  email: 'desk@test.com',
  role: ROLES.RECEPTIONIST,
  permissions: ['booking.read'],
  libraryId,
  branchId,
  studentId: null,
  isActive: true,
});

async function seed() {
  const library = await LibraryModel.create({
    name: 'Hold Hub',
    slug: `hold-${crypto.randomBytes(3).toString('hex')}`,
    email: 'owner@holdhub.com',
    phone: '+91 9999999999',
    status: 'ACTIVE',
    subscriptionPlan: 'FREE',
    settings: {
      publicBookingPage: {
        publicPageEnabled: true,
        publicSlug: `hold-${crypto.randomBytes(2).toString('hex')}`,
        bookingEnabled: true,
        offlinePaymentAllowed: true,
      },
    },
  });
  const branch = await BranchModel.create({
    libraryId: library._id,
    branchName: 'Main',
    branchCode: 'MAIN',
    email: 'b@test.com',
  });
  const shift = await ShiftModel.create({
    libraryId: library._id,
    branchId: branch._id,
    name: 'Morning',
    startTime: '06:00',
    endTime: '12:00',
    type: 'MORNING',
    active: true,
  });
  const seat = await SeatModel.create({
    libraryId: library._id,
    branchId: branch._id,
    seatNumber: 'H1',
    floor: '1',
    zone: 'A',
    status: 'AVAILABLE',
    active: true,
  });
  const feePlan = await FeePlanModel.create({
    libraryId: library._id,
    branchId: branch._id,
    name: 'Monthly',
    type: 'MEMBERSHIP',
    amount: 1000,
    durationDays: 30,
    shiftId: shift._id,
    active: true,
  });
  const slug = String(
    (library.settings as { publicBookingPage: { publicSlug: string } }).publicBookingPage.publicSlug,
  );
  return { library, branch, shift, seat, feePlan, slug };
}

describe('public booking holds in occupancy', () => {
  it('shows RESERVED on public availability without visitor details', async () => {
    const { library, branch, shift, seat, feePlan, slug } = await seed();
    await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Visitor One',
      phone: '+91 9000000001',
    });

    const availability = await publicBookingService.getPublicAvailability(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
    });
    const row = availability.seats.find((s) => s._id === String(seat._id));
    expect(row?.status).toBe(PUBLIC_SEAT_CELL_STATUS.RESERVED);
    expect(availability.seats.every((s) => !('fullName' in s))).toBe(true);
  });

  it('shows PUBLIC_HOLD internally with visitor details', async () => {
    const { library, branch, shift, seat, feePlan, slug } = await seed();
    await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Visitor Two',
      phone: '+91 9000000002',
    });

    const grid = await seatOccupancyService.getGrid(owner(String(library._id)), {
      branchId: String(branch._id),
    });
    const cell = grid.cells[String(shift._id)]?.[String(seat._id)];
    expect(cell?.state).toBe(OCCUPANCY_CELL_STATE.PUBLIC_HOLD);
    expect(cell?.publicHold?.fullName).toBe('Visitor Two');
    expect(cell?.publicHold?.phone).toBe('+91 9000000002');
    expect(cell?.publicHold?.bookingReference).toBeTruthy();
  });

  it('allows owner to release hold and frees public availability', async () => {
    const { library, branch, shift, seat, feePlan, slug } = await seed();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Visitor Three',
      phone: '+91 9000000003',
    });
    const bookingId = String((created.booking as { _id: string })._id);

    await publicBookingService.releaseHoldByStaff(owner(String(library._id)), bookingId);

    const { PublicSeatBookingModel } = await import('./public-booking.model');
    const doc = await PublicSeatBookingModel.findById(bookingId).lean();
    expect(doc?.bookingStatus).toBe(PUBLIC_BOOKING_STATUS.RELEASED_BY_STAFF);

    const availability = await publicBookingService.getPublicAvailability(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
    });
    const row = availability.seats.find((s) => s._id === String(seat._id));
    expect(row?.status).toBe(PUBLIC_SEAT_CELL_STATUS.AVAILABLE);

    const seatDoc = await SeatModel.findById(seat._id).lean();
    expect(seatDoc?.status).toBe('AVAILABLE');
  });

  it('denies release for user without override permission', async () => {
    const { library, branch, shift, seat, feePlan, slug } = await seed();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Visitor Four',
      phone: '+91 9000000004',
    });
    const bookingId = String((created.booking as { _id: string })._id);

    expect(() => assertCanReleasePublicHold(receptionist(String(library._id), String(branch._id)))).toThrow();
  });
});
