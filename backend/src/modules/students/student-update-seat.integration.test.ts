import crypto from 'node:crypto';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@/types/express';
import { PERMISSIONS } from '@constants/permissions.constants';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { ShiftModel } from '@modules/shifts/shift.model';
import { SeatModel } from '@modules/seats/seat.model';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { StudentModel } from '@modules/students/students.models';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

import { studentService } from './student.service';

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

const ownerUser = (libraryId: string): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Owner',
  email: 'owner@test.com',
  role: 'LIBRARY_OWNER',
  permissions: [
    PERMISSIONS.STUDENT_READ,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.STUDENT_ASSIGN_SEAT,
    PERMISSIONS.SEAT_ASSIGN,
  ],
  libraryId,
  branchId: null,
  studentId: null,
  isActive: true,
});

async function seedAssignedStudent() {
  const library = await LibraryModel.create({
    name: 'Seat Update Lib',
    slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
    email: 'lib@test.com',
    status: 'ACTIVE',
    subscriptionPlan: 'FREE',
  });
  const branch = await BranchModel.create({
    libraryId: library._id,
    branchName: 'Main',
    branchCode: 'MAIN',
    email: 'b@test.com',
    city: 'Jaipur',
  });
  const morning = await ShiftModel.create({
    libraryId: library._id,
    branchId: branch._id,
    name: 'Morning',
    startTime: '06:00',
    endTime: '12:00',
    type: 'MORNING',
    active: true,
  });
  const evening = await ShiftModel.create({
    libraryId: library._id,
    branchId: branch._id,
    name: 'Evening',
    startTime: '17:00',
    endTime: '22:00',
    type: 'EVENING',
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
  const student = await StudentModel.create({
    libraryId: library._id,
    branchId: branch._id,
    studentId: 'STU-1',
    fullName: 'Overlap Test',
    email: 'overlap@test.com',
    phone: '9999999999',
    gender: 'UNSPECIFIED',
    admissionDate: new Date(),
    membershipStartDate: new Date(),
    membershipEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'ACTIVE',
    assignedSeatId: seat._id,
    currentShiftId: morning._id,
  });
  await SeatAssignmentModel.create({
    libraryId: library._id,
    branchId: branch._id,
    seatId: seat._id,
    studentId: student._id,
    shiftId: morning._id,
    startDate: new Date(),
    endDate: null,
    status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
    assignedBy: new mongoose.Types.ObjectId(),
  });
  return {
    libraryId: String(library._id),
    studentId: String(student._id),
    seatId: String(seat._id),
    morningId: String(morning._id),
    eveningId: String(evening._id),
  };
}

describe('student update seat sync', () => {
  it('profile-only update does not trigger overlap error when seat is unchanged', async () => {
    const { libraryId, studentId, seatId, morningId } = await seedAssignedStudent();
    const user = ownerUser(libraryId);

    await expect(
      studentService.updateStudent(user, studentId, {
        phone: '8888888888',
        assignedSeatId: seatId,
        shiftId: morningId,
      }),
    ).resolves.toBeTruthy();

    const assignments = await SeatAssignmentModel.find({ studentId }).lean();
    expect(assignments.filter((a) => a.status === SHIFT_ASSIGNMENT_STATUS.ACTIVE)).toHaveLength(1);
  });

  it('changing to a conflicting shift on the same seat still blocks', async () => {
    const { libraryId, studentId, seatId, eveningId } = await seedAssignedStudent();
    const user = ownerUser(libraryId);

    const otherStudent = await StudentModel.create({
      libraryId: new mongoose.Types.ObjectId(libraryId),
      branchId: (await StudentModel.findById(studentId))!.branchId,
      studentId: 'STU-2',
      fullName: 'Evening User',
      email: 'evening@test.com',
      phone: '7777777777',
      gender: 'UNSPECIFIED',
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      membershipEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'ACTIVE',
    });
    await SeatAssignmentModel.create({
      libraryId: otherStudent.libraryId,
      branchId: otherStudent.branchId,
      seatId: new mongoose.Types.ObjectId(seatId),
      studentId: otherStudent._id,
      shiftId: new mongoose.Types.ObjectId(eveningId),
      startDate: new Date(),
      endDate: null,
      status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
      assignedBy: new mongoose.Types.ObjectId(),
    });

    await expect(
      studentService.updateStudent(user, studentId, {
        assignedSeatId: seatId,
        shiftId: eveningId,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
