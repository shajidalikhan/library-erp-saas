import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { DEFAULT_TIMEZONE, LIBRARY_STATUS, SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { StudentModel } from '@modules/students/students.models';
import { STUDENT_STATUS } from '@modules/students/student.constants';
import { SeatModel } from '@modules/seats/seat.model';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { PaymentRecordModel } from '@modules/payments/payment-record.model';

import { analyticsService } from './analytics.service';

let mongo: MongoMemoryServer;

const allPerms = Object.values(PERMISSIONS) as AuthenticatedUser['permissions'];

function ownerOf(libraryId: string, branchId: string | null): AuthenticatedUser {
  return {
    id: new mongoose.Types.ObjectId().toString(),
    role: ROLES.LIBRARY_OWNER,
    permissions: allPerms,
    libraryId,
    branchId,
  };
}

function intruder(): AuthenticatedUser {
  return {
    id: new mongoose.Types.ObjectId().toString(),
    role: ROLES.LIBRARY_OWNER,
    permissions: allPerms,
    libraryId: new mongoose.Types.ObjectId().toString(),
    branchId: null,
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  await Promise.all([
    PaymentRecordModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    StudentModel.deleteMany({}),
    SeatModel.deleteMany({}),
    BranchModel.deleteMany({}),
    LibraryModel.deleteMany({}),
  ]);
});

describe('analytics.service', () => {
  it('overview respects tenant isolation', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const libA = await LibraryModel.create({
      name: `A ${suffix}`,
      slug: `a-${suffix}`,
      email: `a-${suffix}@ex.com`,
      timezone: DEFAULT_TIMEZONE,
      subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
      status: LIBRARY_STATUS.ACTIVE,
      settings: {},
    });
    const libB = await LibraryModel.create({
      name: `B ${suffix}`,
      slug: `b-${suffix}`,
      email: `b-${suffix}@ex.com`,
      timezone: DEFAULT_TIMEZONE,
      subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
      status: LIBRARY_STATUS.ACTIVE,
      settings: {},
    });
    const brA = await BranchModel.create({
      libraryId: libA._id,
      branchName: 'Main',
      branchCode: `MA${suffix.slice(0, 4)}`.toUpperCase(),
      email: `br-a-${suffix}@ex.com`,
      totalSeats: 10,
      active: true,
    });
    await BranchModel.create({
      libraryId: libB._id,
      branchName: 'Other',
      branchCode: `OT${suffix.slice(0, 4)}`.toUpperCase(),
      email: `br-b-${suffix}@ex.com`,
      totalSeats: 5,
      active: true,
    });

    await StudentModel.create({
      libraryId: libA._id,
      branchId: brA._id,
      studentId: `S-${suffix}`,
      fullName: 'Alice',
      email: `alice-${suffix}@ex.com`,
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      status: STUDENT_STATUS.ACTIVE,
      assignedSeatId: null,
      userId: null,
    });
    await StudentModel.create({
      libraryId: libB._id,
      branchId: (await BranchModel.findOne({ libraryId: libB._id }).lean())!._id,
      studentId: `T-${suffix}`,
      fullName: 'Bob',
      email: `bob-${suffix}@ex.com`,
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      status: STUDENT_STATUS.ACTIVE,
      assignedSeatId: null,
      userId: null,
    });

    const ownerA = ownerOf(String(libA._id), null);
    const oA = await analyticsService.getOverview(ownerA, { range: '30d' });
    expect(oA.totalStudents).toBe(1);

    const bad = intruder();
    const oBad = await analyticsService.getOverview(bad, { range: '30d' });
    expect(oBad.totalStudents).toBe(0);
  });

  it('trends daily sums revenue in range', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const lib = await LibraryModel.create({
      name: `R ${suffix}`,
      slug: `r-${suffix}`,
      email: `r-${suffix}@ex.com`,
      timezone: DEFAULT_TIMEZONE,
      subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
      status: LIBRARY_STATUS.ACTIVE,
      settings: {},
    });
    const br = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Main',
      branchCode: `MR${suffix.slice(0, 4)}`.toUpperCase(),
      email: `br-${suffix}@ex.com`,
      totalSeats: 10,
      active: true,
    });
    const stu = await StudentModel.create({
      libraryId: lib._id,
      branchId: br._id,
      studentId: `RS-${suffix}`,
      fullName: 'Pay',
      email: `pay-${suffix}@ex.com`,
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      status: STUDENT_STATUS.ACTIVE,
      assignedSeatId: null,
      userId: null,
    });
    const inv = await InvoiceModel.create({
      libraryId: lib._id,
      branchId: br._id,
      studentId: stu._id,
      seatId: null,
      feePlanId: null,
      invoiceNumber: `INV-${suffix}`,
      amount: 100,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 100,
      paidAmount: 100,
      refundTotal: 0,
      dueAmount: 0,
      status: 'PAID',
      dueDate: new Date(),
      currency: 'INR',
    });
    await PaymentRecordModel.create({
      libraryId: lib._id,
      branchId: br._id,
      studentId: stu._id,
      invoiceId: inv._id,
      amount: 250,
      method: 'CASH',
      receiptNumber: `RCP-${suffix}`,
      receivedBy: new mongoose.Types.ObjectId(),
      paidAt: new Date(),
      status: 'ACTIVE',
      refundedAmount: 0,
    });

    const user = ownerOf(String(lib._id), String(br._id));
    const tr = await analyticsService.getTrendsDaily(user, { range: '7d' });
    const sum = tr.series.reduce((a, r) => a + (r.revenue ?? 0), 0);
    expect(sum).toBeGreaterThanOrEqual(250);
  });
});
