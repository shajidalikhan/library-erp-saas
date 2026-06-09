import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { Types } from 'mongoose';

import { connectDB, disconnectDB } from '@config/db';
import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { FeePlanModel } from '@modules/payments/payments.models';
import { ShiftModel } from '@modules/shifts/shift.model';
import { SeatModel } from '@modules/seats/seat.model';
import { StudentModel } from '@modules/students/students.models';
import { InvoiceModel } from '@modules/payments/invoice.model';

import { studentAdmissionService } from './student-admission.service';

const ownerUser = (libraryId: string, branchId: string): AuthenticatedUser =>
  ({
    id: String(new Types.ObjectId()),
    role: ROLES.LIBRARY_OWNER,
    libraryId,
    branchId: undefined,
    permissions: Object.values(PERMISSIONS),
  }) as AuthenticatedUser;

describe('student admission', () => {
  let libraryId: string;
  let branchId: string;
  let shiftId: string;
  let feePlanId: string;
  let seatId: string;

  beforeAll(async () => {
    await connectDB();
    const lib = await LibraryModel.create({
      name: `Admit Lib ${Date.now()}`,
      slug: `admit-${Date.now()}`,
      contactEmail: 'admit@test.com',
      active: true,
    });
    libraryId = String(lib._id);
    const branch = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Main',
      branchCode: 'MAIN',
      email: 'b@test.com',
      active: true,
      totalSeats: 10,
    });
    branchId = String(branch._id);
    const shift = await ShiftModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      name: 'Morning',
      startTime: '06:00',
      endTime: '12:00',
      type: 'MORNING',
      active: true,
    });
    shiftId = String(shift._id);
    const plan = await FeePlanModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      name: 'Monthly',
      type: 'MEMBERSHIP',
      amount: 1000,
      durationDays: 30,
      active: true,
    });
    feePlanId = String(plan._id);
    const seat = await SeatModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      seatNumber: 'A1',
      floor: '1',
      zone: 'General',
      seatType: 'STANDARD',
      status: 'AVAILABLE',
      active: true,
      occupied: false,
      assignedStudentId: null,
    });
    seatId = String(seat._id);
  });

  afterAll(async () => {
    await disconnectDB();
  });

  it('creates student only', async () => {
    const email = `solo-${Date.now()}@test.com`;
    const result = await studentAdmissionService.admitStudent(ownerUser(libraryId, branchId), {
      branchId,
      fullName: 'Solo Student',
      email,
      createLoginAccount: false,
    });
    expect(result.student).toBeTruthy();
    expect(result.membership).toBeNull();
    expect(result.invoice).toBeNull();
    await StudentModel.deleteOne({ _id: (result.student as { _id: string })._id });
  });

  it('creates student with membership, invoice, partial payment, and seat', async () => {
    const email = `full-${Date.now()}@test.com`;
    const start = new Date();
    const result = await studentAdmissionService.admitStudent(ownerUser(libraryId, branchId), {
      branchId,
      fullName: 'Full Admit',
      email,
      createLoginAccount: false,
      membership: {
        enabled: true,
        shiftId,
        feePlanId,
        startDate: start,
      },
      seatAssignment: {
        enabled: true,
        seatId,
        shiftId,
      },
      payment: {
        enabled: true,
        paidAmount: 400,
        method: 'CASH',
      },
    });

    expect(result.student).toBeTruthy();
    expect(result.membership).toBeTruthy();
    expect(result.seatAssignment).toBeTruthy();
    expect(result.invoice).toBeTruthy();
    expect((result.invoice as { status: string }).status).toBe('PARTIAL');
    expect(result.payment).toBeTruthy();

    const sid = (result.student as { _id: string })._id;
    await Promise.all([
      StudentModel.deleteOne({ _id: sid }),
      InvoiceModel.deleteMany({ studentId: sid }),
    ]);
  });
});
