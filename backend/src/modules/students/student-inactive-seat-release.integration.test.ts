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
import { PaymentRecordModel } from '@modules/payments/payment-record.model';
import { AuditLogModel } from '@modules/platform/audit-log.model';
import { syncStudentMembershipDates } from '@modules/membership/membership.service';

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
    PERMISSIONS.STUDENT_DELETE,
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
    name: 'Release Lib',
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
    studentId: 'STU-REL-1',
    fullName: 'Seat Release Test',
    email: 'release@test.com',
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
  await SeatModel.updateOne(
    { _id: seat._id },
    { $set: { assignedStudentId: student._id, occupied: true, status: 'OCCUPIED' } },
  );
  return {
    libraryId: String(library._id),
    branchId: String(branch._id),
    studentId: String(student._id),
    seatId: String(seat._id),
    morningId: String(morning._id),
  };
}

describe('student inactive seat release', () => {
  it('marks inactive student and releases seat assignments', async () => {
    const { libraryId, studentId, seatId } = await seedAssignedStudent();
    const user = ownerUser(libraryId);

    await studentService.updateStudent(user, studentId, { status: 'INACTIVE' });

    const student = await StudentModel.findById(studentId).lean();
    expect(student?.status).toBe('INACTIVE');
    expect(student?.assignedSeatId).toBeNull();
    expect(student?.currentShiftId).toBeNull();

    const assignments = await SeatAssignmentModel.find({ studentId }).lean();
    expect(assignments.every((a) => a.status === SHIFT_ASSIGNMENT_STATUS.CANCELLED)).toBe(true);
    expect(assignments.every((a) => a.releasedReason === 'Student marked inactive')).toBe(true);
    expect(assignments.every((a) => a.endedAt)).toBe(true);

    const seat = await SeatModel.findById(seatId).lean();
    expect(seat?.assignedStudentId).toBeNull();
    expect(seat?.occupied).toBe(false);
    expect(seat?.status).toBe('AVAILABLE');

    const audit = await AuditLogModel.findOne({ action: 'STUDENT_SEAT_RELEASED', entityId: studentId });
    expect(audit).toBeTruthy();
  });

  it('soft deleted student releases seat', async () => {
    const { libraryId, branchId, studentId, seatId } = await seedAssignedStudent();
    const user = ownerUser(libraryId);

    await PaymentRecordModel.create({
      libraryId: new mongoose.Types.ObjectId(libraryId),
      branchId: new mongoose.Types.ObjectId(branchId),
      studentId: new mongoose.Types.ObjectId(studentId),
      invoiceId: new mongoose.Types.ObjectId(),
      amount: 100,
      method: 'CASH',
      receiptNumber: 'RCP-REL-1',
      receivedBy: new mongoose.Types.ObjectId(user.id),
      paidAt: new Date(),
      status: 'ACTIVE',
    });

    const result = await studentService.deleteStudent(user, studentId);
    expect(result.softDeleted).toBe(true);

    const student = await StudentModel.findById(studentId).lean();
    expect(student?.status).toBe('INACTIVE');
    expect(student?.assignedSeatId).toBeNull();

    const seat = await SeatModel.findById(seatId).lean();
    expect(seat?.status).toBe('AVAILABLE');
  });

  it('expired membership releases seat with EXPIRED assignment status', async () => {
    const { studentId, seatId } = await seedAssignedStudent();
    const pastEnd = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const pastStart = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);

    await syncStudentMembershipDates(studentId, pastStart, pastEnd);

    const student = await StudentModel.findById(studentId).lean();
    expect(student?.status).toBe('SUSPENDED');
    expect(student?.assignedSeatId).toBeNull();

    const assignment = await SeatAssignmentModel.findOne({ studentId }).lean();
    expect(assignment?.status).toBe(SHIFT_ASSIGNMENT_STATUS.EXPIRED);
    expect(assignment?.releasedReason).toBe('Membership expired');

    const seat = await SeatModel.findById(seatId).lean();
    expect(seat?.status).toBe('AVAILABLE');
  });

  it('active student profile update keeps seat assignment', async () => {
    const { libraryId, studentId, seatId, morningId } = await seedAssignedStudent();
    const user = ownerUser(libraryId);

    await studentService.updateStudent(user, studentId, {
      phone: '8888888888',
      assignedSeatId: seatId,
      shiftId: morningId,
    });

    const student = await StudentModel.findById(studentId).lean();
    expect(student?.status).toBe('ACTIVE');
    expect(String(student?.assignedSeatId)).toBe(seatId);

    const activeAssignments = await SeatAssignmentModel.find({
      studentId,
      status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
    }).lean();
    expect(activeAssignments).toHaveLength(1);
  });
});
