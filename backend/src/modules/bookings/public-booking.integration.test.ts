import crypto from 'node:crypto';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@/types/express';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { FeePlanModel } from '@modules/payments/payments.models';
import { ShiftModel } from '@modules/shifts/shift.model';
import { SeatModel } from '@modules/seats/seat.model';
import { StudentModel } from '@modules/students/students.models';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { MembershipModel } from '@modules/membership/membership.model';
import { InvoiceModel } from '@modules/payments/invoice.model';

import { PUBLIC_BOOKING_STATUS, PUBLIC_PAYMENT_STATUS } from './public-booking.constants';
import { PublicSeatBookingModel } from './public-booking.model';
import { expirePublicSeatHolds, publicBookingService } from './public-booking.service';

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

const ownerUser = (libraryId: string, branchId?: string | null): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Owner',
  email: 'owner@test.com',
  role: 'LIBRARY_OWNER',
  permissions: ['booking.read', 'booking.update', 'booking.convert'],
  libraryId,
  branchId: branchId ?? null,
  studentId: null,
  isActive: true,
});

async function seedBookingSetup() {
  const library = await LibraryModel.create({
    name: 'Public Hub',
    slug: `pub-${crypto.randomBytes(3).toString('hex')}`,
    email: 'owner@publichub.com',
    phone: '+91 9999999999',
    address: 'Main Road',
    city: 'Jaipur',
    status: 'ACTIVE',
    subscriptionPlan: 'FREE',
    settings: {
      publicBookingPage: {
        publicPageEnabled: true,
        publicSlug: `public-${crypto.randomBytes(2).toString('hex')}`,
        publicDescription: 'Public booking enabled',
        showPhone: true,
        showEmail: false,
        bookingEnabled: true,
        onlinePaymentEnabled: true,
        offlinePaymentAllowed: true,
        requireOwnerApproval: true,
        publicPhotos: ['https://img.example.com/1.jpg'],
        amenities: ['WiFi', 'AC'],
        rules: ['Silence'],
      },
    },
  });

  const branch = await BranchModel.create({
    libraryId: library._id,
    branchName: 'Main Branch',
    branchCode: 'MAIN',
    email: 'branch@publichub.com',
    city: 'Jaipur',
    address: 'Main Road',
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
    seatNumber: 'A1',
    floor: '1',
    zone: 'A',
    seatType: 'STANDARD',
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

  return { library, branch, shift, seat, feePlan, slug: String((library.settings as { publicBookingPage: { publicSlug: string } }).publicBookingPage.publicSlug) };
}

describe('public bookings', () => {
  it('public page exposes safe data only', async () => {
    const { slug } = await seedBookingSetup();
    const profile = await publicBookingService.getPublicLibraryProfile(slug);

    expect(profile.library.name).toBeTruthy();
    expect((profile.library as Record<string, unknown>).settings).toBeUndefined();
    expect((profile as Record<string, unknown>).payments).toBeUndefined();
    expect(profile.library.phone).toBeTruthy();
  });

  it('defaults public booking settings to hide full seat breakdown', async () => {
    const { slug } = await seedBookingSetup();
    const profile = await publicBookingService.getPublicLibraryProfile(slug);
    expect(profile.publicBookingSettings.showFullSeatBreakdown).toBe(false);
  });

  it('exposes per-shift available seats and starting price', async () => {
    const { slug, shift } = await seedBookingSetup();
    const profile = await publicBookingService.getPublicLibraryProfile(slug);
    const stat = profile.shiftStats.find((row) => row.shiftId === String(shift._id));
    expect(stat?.availableSeats).toBe(1);
    expect(stat?.startingPrice).toBe(1000);
    expect(stat?.planCount).toBeGreaterThan(0);
  });

  it('maps unavailable seats to NOT_AVAILABLE when breakdown is disabled', async () => {
    const { slug, library, branch, shift, seat } = await seedBookingSetup();
    const student = await StudentModel.create({
      libraryId: library._id,
      branchId: branch._id,
      studentId: 'STU-OCC',
      fullName: 'Occupied User',
      email: 'occ@example.com',
      phone: '9999999998',
      gender: 'UNSPECIFIED',
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      userId: null,
      assignedSeatId: seat._id,
    });
    await SeatAssignmentModel.create({
      libraryId: library._id,
      branchId: branch._id,
      seatId: seat._id,
      studentId: student._id,
      shiftId: shift._id,
      startDate: new Date(),
      endDate: null,
      status: 'ACTIVE',
      assignedBy: new mongoose.Types.ObjectId(),
    });

    const availability = await publicBookingService.getPublicAvailability(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
    });
    expect(availability.seats[0]?.status).toBe('NOT_AVAILABLE');
  });

  it('shows full seat status labels when breakdown is enabled', async () => {
    const { slug, library, branch, shift, seat } = await seedBookingSetup();
    await LibraryModel.updateOne(
      { _id: library._id },
      { $set: { 'settings.publicBookingPage.showFullSeatBreakdown': true } },
    );
    await SeatModel.updateOne({ _id: seat._id }, { $set: { status: 'BLOCKED' } });

    const availability = await publicBookingService.getPublicAvailability(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
    });
    expect(availability.seats[0]?.status).toBe('BLOCKED');
  });

  it('availability hides student PII', async () => {
    const { slug, library, branch, shift, seat } = await seedBookingSetup();
    const student = await StudentModel.create({
      libraryId: library._id,
      branchId: branch._id,
      studentId: 'STU-PII',
      fullName: 'Secret Name',
      email: 'secret@example.com',
      phone: '9999999999',
      gender: 'UNSPECIFIED',
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
      userId: null,
      assignedSeatId: seat._id,
    });

    await SeatAssignmentModel.create({
      libraryId: library._id,
      branchId: branch._id,
      seatId: seat._id,
      studentId: student._id,
      shiftId: shift._id,
      startDate: new Date(),
      endDate: null,
      status: 'ACTIVE',
      assignedBy: new mongoose.Types.ObjectId(),
    });

    const availability = await publicBookingService.getPublicAvailability(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
    });
    const first = availability.seats[0] as Record<string, unknown>;
    expect(first.fullName).toBeUndefined();
    expect(first.studentId).toBeUndefined();
    expect(first.phone).toBeUndefined();
  });

  it('unavailable seat cannot be booked', async () => {
    const { slug, branch, shift, seat, feePlan } = await seedBookingSetup();
    await SeatModel.updateOne({ _id: seat._id }, { $set: { status: 'BLOCKED' } });

    await expect(
      publicBookingService.createPublicBooking(slug, {
        branchId: String(branch._id),
        shiftId: String(shift._id),
        seatId: String(seat._id),
        feePlanId: String(feePlan._id),
        fullName: 'Test User',
        phone: '9999999999',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('same seat+shift cannot be double booked', async () => {
    const { slug, branch, shift, seat, feePlan } = await seedBookingSetup();
    await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'First',
      phone: '9999990000',
    });

    await expect(
      publicBookingService.createPublicBooking(slug, {
        branchId: String(branch._id),
        shiftId: String(shift._id),
        seatId: String(seat._id),
        feePlanId: String(feePlan._id),
        fullName: 'Second',
        phone: '9999990001',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('offline booking creates pending booking', async () => {
    const { slug, branch, shift, seat, feePlan } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Offline User',
      phone: '9999990002',
    });

    expect((created.booking as { bookingStatus: string }).bookingStatus).toBe(PUBLIC_BOOKING_STATUS.HOLD);
    expect((created.booking as { paymentStatus: string }).paymentStatus).toBe(PUBLIC_PAYMENT_STATUS.PENDING_OFFLINE);
  });

  it('expired hold releases seat', async () => {
    const { slug, branch, shift, seat, feePlan } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Hold User',
      phone: '9999990003',
    });
    const bookingId = String((created.booking as { _id: string })._id);
    await PublicSeatBookingModel.updateOne({ _id: bookingId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const released = await expirePublicSeatHolds();
    expect(released).toBe(1);
    const booking = await PublicSeatBookingModel.findById(bookingId).lean();
    expect(booking?.bookingStatus).toBe(PUBLIC_BOOKING_STATUS.EXPIRED);
    const seatDoc = await SeatModel.findById(seat._id).lean();
    expect(seatDoc?.status).toBe('AVAILABLE');
  });

  it('held seat is masked on public grid unless full breakdown enabled', async () => {
    const { slug, library, branch, shift, seat, feePlan } = await seedBookingSetup();
    await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Reserve User',
      phone: '9999990008',
    });

    const masked = await publicBookingService.getPublicAvailability(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
    });
    const maskedCell = masked.seats.find((s) => s._id === String(seat._id));
    expect(maskedCell?.status).toBe('NOT_AVAILABLE');

    await LibraryModel.updateOne(
      { _id: library._id },
      { $set: { 'settings.publicBookingPage.showFullSeatBreakdown': true } },
    );
    const detailed = await publicBookingService.getPublicAvailability(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
    });
    const detailedCell = detailed.seats.find((s) => s._id === String(seat._id));
    expect(detailedCell?.status).toBe('RESERVED');
  });

  it('approve booking works', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Approve User',
      phone: '9999990004',
    });
    const bookingId = String((created.booking as { _id: string })._id);
    await publicBookingService.approveBooking(ownerUser(String(library._id)), bookingId);
    const doc = await PublicSeatBookingModel.findById(bookingId).lean();
    expect(doc?.bookingStatus).toBe(PUBLIC_BOOKING_STATUS.APPROVED);
  });

  it('reject booking works', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Reject User',
      phone: '9999990005',
    });
    const bookingId = String((created.booking as { _id: string })._id);
    await publicBookingService.rejectBooking(ownerUser(String(library._id)), bookingId, 'Not eligible');
    const doc = await PublicSeatBookingModel.findById(bookingId).lean();
    expect(doc?.bookingStatus).toBe(PUBLIC_BOOKING_STATUS.REJECTED);
  });

  it('convert-to-student creates student, membership, seat assignment, and invoice', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Convert User',
      phone: '9999990006',
    });
    const bookingId = String((created.booking as { _id: string })._id);

    const result = await publicBookingService.convertToStudent(ownerUser(String(library._id)), bookingId);

    expect(result.student).toBeTruthy();
    expect(result.membership).toBeTruthy();
    expect(result.seatAssignment).toBeTruthy();
    expect(result.invoice).toBeTruthy();
    expect(result.payment).toBeNull();

    expect(await StudentModel.countDocuments()).toBe(1);
    expect(await MembershipModel.countDocuments()).toBe(1);
    expect(await SeatAssignmentModel.countDocuments({ status: 'ACTIVE' })).toBe(1);
    expect(await InvoiceModel.countDocuments()).toBe(1);
  });

  it('converted booking cannot be converted again', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Repeat Convert User',
      phone: '9999990010',
    });
    const bookingId = String((created.booking as { _id: string })._id);
    await publicBookingService.convertToStudent(ownerUser(String(library._id)), bookingId);
    await expect(
      publicBookingService.convertToStudent(ownerUser(String(library._id)), bookingId),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('booking detail pre-fills admission form', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Prefill User',
      phone: '9999990011',
      email: 'prefill@example.com',
      guardianName: 'Guardian',
      guardianPhone: '9999990012',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
    });
    const bookingId = String((created.booking as { _id: string })._id);
    const prefill = await publicBookingService.getAdmissionPrefill(ownerUser(String(library._id)), bookingId);
    expect(prefill.fullName).toBe('Prefill User');
    expect(prefill.phone).toBe('9999990011');
    expect(prefill.branchId).toBe(String(branch._id));
    expect(prefill.shiftId).toBe(String(shift._id));
    expect(prefill.seatId).toBe(String(seat._id));
  });

  it('wrong tenant blocked', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Tenant User',
      phone: '9999990007',
    });
    const bookingId = String((created.booking as { _id: string })._id);
    await publicBookingService.approveBooking(ownerUser(String(library._id)), bookingId);

    const anotherLibrary = await LibraryModel.create({
      name: 'Other',
      slug: `other-${crypto.randomBytes(2).toString('hex')}`,
      email: 'other@example.com',
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
    });

    await expect(
      publicBookingService.convertToStudent(ownerUser(String(anotherLibrary._id)), bookingId),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('owner sees only own bookings', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Owner View',
      phone: '9999990013',
    });
    const own = await publicBookingService.listOwnerBookings(ownerUser(String(library._id)), {
      page: 1,
      limit: 10,
    });
    expect(own.items.length).toBe(1);
    expect((own.items[0] as { bookingStatus: string }).bookingStatus).toBe(PUBLIC_BOOKING_STATUS.HOLD);

    const anotherLibrary = await LibraryModel.create({
      name: 'Other Two',
      slug: `other-two-${crypto.randomBytes(2).toString('hex')}`,
      email: 'othertwo@example.com',
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
    });
    const foreign = await publicBookingService.listOwnerBookings(ownerUser(String(anotherLibrary._id)), {
      page: 1,
      limit: 10,
    });
    expect(foreign.items.length).toBe(0);
  });

  it('public booking appears in owner list after submission', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    const created = await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'List Visible User',
      phone: '9999990014',
      email: 'list@example.com',
    });
    const list = await publicBookingService.listOwnerBookings(ownerUser(String(library._id)), {
      page: 1,
      limit: 20,
    });
    expect(list.items.some((row) => String((row as { _id: string })._id) === String((created.booking as { _id: string })._id))).toBe(
      true,
    );
  });

  it('manager sees only assigned branch bookings', async () => {
    const { slug, branch, shift, seat, feePlan, library } = await seedBookingSetup();
    const branchB = await BranchModel.create({
      libraryId: library._id,
      branchName: 'Second Branch',
      branchCode: 'SEC',
      email: 'sec@publichub.com',
      city: 'Jaipur',
    });
    const shiftB = await ShiftModel.create({
      libraryId: library._id,
      branchId: branchB._id,
      name: 'Evening',
      startTime: '14:00',
      endTime: '20:00',
      type: 'EVENING',
      active: true,
    });
    const seatB = await SeatModel.create({
      libraryId: library._id,
      branchId: branchB._id,
      seatNumber: 'B1',
      floor: '1',
      zone: 'B',
      seatType: 'STANDARD',
      status: 'AVAILABLE',
      active: true,
    });
    const feePlanB = await FeePlanModel.create({
      libraryId: library._id,
      branchId: branchB._id,
      name: 'Monthly B',
      type: 'MEMBERSHIP',
      amount: 900,
      durationDays: 30,
      shiftId: shiftB._id,
      active: true,
    });

    await publicBookingService.createPublicBooking(slug, {
      branchId: String(branch._id),
      shiftId: String(shift._id),
      seatId: String(seat._id),
      feePlanId: String(feePlan._id),
      fullName: 'Branch A User',
      phone: '9999990015',
    });
    await publicBookingService.createPublicBooking(slug, {
      branchId: String(branchB._id),
      shiftId: String(shiftB._id),
      seatId: String(seatB._id),
      feePlanId: String(feePlanB._id),
      fullName: 'Branch B User',
      phone: '9999990016',
    });

    const managerList = await publicBookingService.listOwnerBookings(
      {
        ...ownerUser(String(library._id), String(branch._id)),
        role: 'MANAGER',
        permissions: ['booking.read'],
      },
      { page: 1, limit: 20 },
    );
    expect(managerList.items.length).toBe(1);
    expect((managerList.items[0] as { fullName: string }).fullName).toBe('Branch A User');
  });
});
