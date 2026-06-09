import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seat.model';
import { ShiftModel } from '@modules/shifts/shift.model';
import { shiftService } from '@modules/shifts/shift.service';
import { seatService } from '@modules/seats/seat.service';
import { seatOccupancyService } from '@modules/seats/seat-occupancy.service';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { addDays } from '@modules/membership/membership.service';
import type { AuthenticatedUser } from '@/types/express';

let mongo: MongoMemoryServer;

const ownerUser = (libraryId: string): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Owner',
  email: 'owner@test.com',
  role: ROLES.LIBRARY_OWNER,
  permissions: [
    PERMISSIONS.SHIFT_CREATE,
    PERMISSIONS.SHIFT_READ,
    PERMISSIONS.SEAT_ASSIGN,
    PERMISSIONS.SEAT_READ,
    PERMISSIONS.SEAT_OCCUPANCY_READ,
  ],
  libraryId,
  branchId: null,
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

describe('seat occupancy by shift', () => {
  it('allows morning + evening on same seat', async () => {
    const lib = await LibraryModel.create({
      name: 'Occ Lib',
      slug: `occ-${crypto.randomBytes(3).toString('hex')}`,
      email: 'occ@test.com',
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
      seatNumber: 'S8',
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

    const grid = await seatOccupancyService.getGrid(user, { branchId: String(branch._id) });
    const morningRow = grid.cells[String(morning._id)]?.[String(seat._id)];
    const eveningRow = grid.cells[String(evening._id)]?.[String(seat._id)];
    expect(morningRow?.state).toBe('OCCUPIED');
    expect(eveningRow?.state).toBe('OCCUPIED');
    expect(grid.summary.fullyUtilizedSeats).toBeGreaterThanOrEqual(1);
  });

  it('blocks full day when morning exists and blocks overlapping afternoon', async () => {
    const lib = await LibraryModel.create({
      name: 'Block Lib',
      slug: `blk-${crypto.randomBytes(3).toString('hex')}`,
      email: 'blk@test.com',
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
    });
    const branch = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Main',
      branchCode: 'MAIN',
      email: 'b2@test.com',
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
    const afternoon = await shiftService.create(user, {
      libraryId: String(lib._id),
      branchId: String(branch._id),
      name: 'Afternoon',
      startTime: '11:00',
      endTime: '16:00',
      type: 'AFTERNOON',
    });
    const fullDay = await shiftService.create(user, {
      libraryId: String(lib._id),
      branchId: String(branch._id),
      name: 'Full Day',
      startTime: '06:00',
      endTime: '22:00',
      type: 'FULL_DAY',
    });

    const seat = await SeatModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      seatNumber: 'S1',
      floor: '1',
      zone: 'A',
      seatType: 'STANDARD',
      status: 'AVAILABLE',
    });

    const student = await StudentModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      studentId: 'STU-X',
      fullName: 'Test',
      email: 'x@test.com',
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      membershipEndDate: addDays(new Date(), 30),
      status: 'ACTIVE',
    });

    await seatService.assignSeatToStudent(user, String(seat._id), {
      studentId: String(student._id),
      shiftId: String(morning._id),
    });

    await expect(
      seatService.assignSeatToStudent(user, String(seat._id), {
        studentId: String(student._id),
        shiftId: String(afternoon._id),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    await expect(
      seatService.assignSeatToStudent(user, String(seat._id), {
        studentId: String(student._id),
        shiftId: String(fullDay._id),
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const grid = await seatOccupancyService.getGrid(user, { branchId: String(branch._id) });
    expect(grid.cells[String(fullDay._id)]?.[String(seat._id)]?.state).toBe('BLOCKED');
  });

  it('grid counts match active assignments', async () => {
    const lib = await LibraryModel.create({
      name: 'Count Lib',
      slug: `cnt-${crypto.randomBytes(3).toString('hex')}`,
      email: 'cnt@test.com',
      status: 'ACTIVE',
      subscriptionPlan: 'FREE',
    });
    const branch = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Main',
      branchCode: 'MAIN',
      email: 'c@test.com',
    });
    const user = ownerUser(String(lib._id));

    const shift = await ShiftModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      name: 'Morning',
      startTime: '06:00',
      endTime: '12:00',
      type: 'MORNING',
      active: true,
    });

    await SeatModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      seatNumber: 'A1',
      floor: '1',
      zone: 'A',
      seatType: 'STANDARD',
      status: 'AVAILABLE',
    });

    const active = await SeatAssignmentModel.countDocuments({ status: 'ACTIVE' });
    const grid = await seatOccupancyService.getGrid(user, { branchId: String(branch._id) });
    expect(grid.summary.totalSeats).toBe(1);
    expect(grid.summary.totalShifts).toBe(1);
    expect(grid.summary.occupiedByShift[0]?.occupied).toBe(active);
  });
});
