import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seat.model';
import { ShiftModel } from './shift.model';
import { shiftService } from './shift.service';
import { seatService } from '@modules/seats/seat.service';
import { membershipService, addDays } from '@modules/membership/membership.service';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import type { AuthenticatedUser } from '@/types/express';

let mongo: MongoMemoryServer;

const ownerUser = (libraryId: string, branchId: string | null = null): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Owner',
  email: 'owner@test.com',
  role: ROLES.LIBRARY_OWNER,
  permissions: [PERMISSIONS.SHIFT_CREATE, PERMISSIONS.SHIFT_READ, PERMISSIONS.SEAT_ASSIGN, PERMISSIONS.MEMBERSHIP_CREATE],
  libraryId,
  branchId,
  studentId: null,
  isActive: true,
});

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

describe('shifts, seat assignment, membership', () => {
  it('creates shift and blocks duplicate seat+shift assignment', async () => {
    const lib = await LibraryModel.create({
      name: 'Test Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'lib@test.com',
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
    });
    const branch = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Main',
      branchCode: 'MAIN',
      email: 'b@test.com',
    });
    const user = ownerUser(String(lib._id));

    const morning = await shiftService.create(user, {
      libraryId: String(lib._id),
      branchId: String(branch._id),
      name: 'Morning',
      startTime: '06:00',
      endTime: '12:00',
      type: 'MORNING',
    });
    const evening = await shiftService.create(user, {
      libraryId: String(lib._id),
      branchId: String(branch._id),
      name: 'Evening',
      startTime: '17:00',
      endTime: '22:00',
      type: 'EVENING',
    });

    const seat = await SeatModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      seatNumber: 'A1',
      floor: '1',
      zone: 'A',
      seatType: 'STANDARD',
      status: 'AVAILABLE',
    });

    const s1 = await StudentModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      studentId: 'STU-1',
      fullName: 'Rahul',
      email: 'r@test.com',
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      membershipEndDate: addDays(new Date(), 30),
      status: 'ACTIVE',
    });

    const s2 = await StudentModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      studentId: 'STU-2',
      fullName: 'Aman',
      email: 'a@test.com',
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      membershipEndDate: addDays(new Date(), 30),
      status: 'ACTIVE',
    });

    await seatService.assignSeatToStudent(user, String(seat._id), {
      studentId: String(s1._id),
      shiftId: String(morning._id),
    });
    await seatService.assignSeatToStudent(user, String(seat._id), {
      studentId: String(s2._id),
      shiftId: String(evening._id),
    });

    const count = await SeatAssignmentModel.countDocuments({
      seatId: seat._id,
      status: 'ACTIVE',
    });
    expect(count).toBe(2);

    await expect(
      seatService.assignSeatToStudent(user, String(seat._id), {
        studentId: String(s2._id),
        shiftId: String(morning._id),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('extends membership from payment flow helper', async () => {
    const lib = await LibraryModel.create({
      name: 'Pay Lib',
      slug: `pay-${crypto.randomBytes(3).toString('hex')}`,
      email: 'pay@test.com',
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
    });
    const branch = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'B1',
      branchCode: 'B1',
      email: 'b1@test.com',
    });
    const expiredEnd = new Date();
    expiredEnd.setDate(expiredEnd.getDate() - 5);
    const student = await StudentModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      studentId: 'STU-PAY',
      fullName: 'Pay Student',
      email: 'pay-s@test.com',
      admissionDate: new Date(),
      membershipStartDate: addDays(expiredEnd, -30),
      membershipEndDate: expiredEnd,
      status: 'SUSPENDED',
    });

    await membershipService.extendFromPayment({
      studentId: student._id as mongoose.Types.ObjectId,
      libraryId: lib._id as mongoose.Types.ObjectId,
      branchId: branch._id as mongoose.Types.ObjectId,
      invoiceId: new mongoose.Types.ObjectId(),
      paymentId: new mongoose.Types.ObjectId(),
      durationDays: 30,
    });

    const updated = await StudentModel.findById(student._id);
    expect(updated?.membershipEndDate).toBeTruthy();
    expect(new Date(updated!.membershipEndDate!).getTime()).toBeGreaterThan(Date.now());
    expect(updated?.status).toBe('ACTIVE');
  });
});
