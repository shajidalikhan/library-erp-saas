import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { DEFAULT_TIMEZONE, LIBRARY_STATUS, SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { FeePlanModel, InvoiceModel } from '@modules/payments/payments.models';
import { paymentService } from '@modules/payments/payment.service';
import { StudentModel } from '@modules/students/students.models';
import { STUDENT_STATUS } from '@modules/students/student.constants';
import { ShiftModel } from '@modules/shifts/shift.model';

import { MembershipModel } from './membership.model';
import { DOWNGRADE_STATUS } from './membership.constants';
import {
  applyPartialPlanOnMembership,
  processPendingMembershipDowngrades,
  resolveDowngradeOnInvoicePayment,
} from './membership-partial.service';
import { membershipService, addDays } from './membership.service';
import { resolvePartialPlanConfig } from './partial-plan.util';

function staff(id: string, libraryId: string, branchId: string): AuthenticatedUser {
  return {
    id,
    role: ROLES.LIBRARY_OWNER,
    permissions: [
      PERMISSIONS.FEE_PLAN_CREATE,
      PERMISSIONS.PAYMENT_CREATE,
      PERMISSIONS.PAYMENT_READ,
      PERMISSIONS.MEMBERSHIP_CREATE,
      PERMISSIONS.MEMBERSHIP_READ,
    ],
    libraryId,
    branchId,
  };
}

type Seed = { libraryId: string; branchId: string; studentId: string; staffId: string; shiftId: string };

async function seedPartialTenant(): Promise<Seed> {
  const suffix = crypto.randomBytes(6).toString('hex');
  const lib = await LibraryModel.create({
    name: `Partial Lib ${suffix}`,
    slug: `partial-lib-${suffix}`,
    email: `partial-${suffix}@example.com`,
    timezone: DEFAULT_TIMEZONE,
    subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
    status: LIBRARY_STATUS.ACTIVE,
    settings: {
      membership: { partialDueDays: 7, defaultDowngradeDurationDays: 30, allowLongPlanPartialStart: true },
    },
  });
  const branch = await BranchModel.create({
    libraryId: lib._id,
    branchName: `Branch ${suffix}`,
    branchCode: `PB${suffix.slice(0, 4)}`.toUpperCase(),
    email: `br-${suffix}@example.com`,
    totalSeats: 20,
    active: true,
  });
  const shift = await ShiftModel.create({
    libraryId: lib._id,
    branchId: branch._id,
    name: 'Full Day',
    type: 'FULL_DAY',
    startTime: '06:00',
    endTime: '22:00',
    active: true,
  });
  const student = await StudentModel.create({
    libraryId: lib._id,
    branchId: branch._id,
    studentId: `STU-${suffix}`,
    fullName: 'Partial Test Student',
    email: `stu-${suffix}@example.com`,
    admissionDate: new Date('2026-01-01'),
    membershipStartDate: new Date('2026-01-01'),
    status: STUDENT_STATUS.ACTIVE,
  });
  return {
    libraryId: String(lib._id),
    branchId: String(branch._id),
    studentId: String(student._id),
    staffId: new mongoose.Types.ObjectId().toString(),
    shiftId: String(shift._id),
  };
}

async function createSixMonthPlan(seed: Seed, user: AuthenticatedUser) {
  return paymentService.createFeePlan(user, {
    branchId: seed.branchId,
    name: '6 Month Plan',
    type: 'MEMBERSHIP',
    amount: 11000,
    durationDays: 180,
    billingDurationMonths: 6,
    allowPartialStart: true,
    minimumStartAmountType: 'ONE_MONTH',
    minimumStartAmount: 2200,
    partialDueDays: 7,
    downgradeIfUnpaid: true,
    downgradeDurationDays: 30,
    offerLabel: '6 Months Membership',
  });
}

async function wipe(): Promise<void> {
  await Promise.all([
    MembershipModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    FeePlanModel.deleteMany({}),
    StudentModel.deleteMany({}),
    ShiftModel.deleteMany({}),
    BranchModel.deleteMany({}),
    LibraryModel.deleteMany({}),
  ]);
}

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  await wipe();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe('long-duration partial membership', () => {
  it('full payment keeps full duration and NOT_REQUIRED downgrade status', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    const plan = await createSixMonthPlan(seed, user);
    const start = new Date('2026-06-01');
    const membership = await membershipService.createMembership(user, {
      studentId: seed.studentId,
      libraryId: seed.libraryId,
      branchId: seed.branchId,
      shiftId: seed.shiftId,
      membershipType: 'FULL_DAY',
      startDate: start,
      durationDays: 180,
      feePlanId: String((plan as { _id: string })._id),
    });
    const dueDate = new Date('2026-06-08');
    const invoice = await paymentService.createInvoice(user, {
      branchId: seed.branchId,
      studentId: seed.studentId,
      feePlanId: String((plan as { _id: string })._id),
      dueDate,
      membershipPeriodStart: start,
      membershipPeriodEnd: addDays(start, 180),
    });
    const config = resolvePartialPlanConfig(plan as never);
    await applyPartialPlanOnMembership({
      membershipId: (membership as { _id: string })._id,
      feePlan: plan as never,
      config,
      invoiceAmount: 11000,
      paidAmount: 11000,
      startDate: start,
      selectedDurationDays: 180,
      invoiceId: (invoice as { _id: string })._id,
      downgradeDueDate: dueDate,
    });
    const row = await MembershipModel.findById((membership as { _id: string })._id).lean();
    expect(row?.downgradeStatus).toBe(DOWNGRADE_STATUS.NOT_REQUIRED);
    expect(row?.selectedPlanDurationDays).toBe(180);
    expect(row?.effectiveDurationDays).toBe(180);
  });

  it('minimum payment creates partial invoice and PENDING downgrade', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    const plan = await createSixMonthPlan(seed, user);
    const start = new Date('2026-06-01');
    const membership = await membershipService.createMembership(user, {
      studentId: seed.studentId,
      libraryId: seed.libraryId,
      branchId: seed.branchId,
      shiftId: seed.shiftId,
      membershipType: 'FULL_DAY',
      startDate: start,
      durationDays: 180,
      feePlanId: String((plan as { _id: string })._id),
    });
    const dueDate = new Date('2026-06-08');
    const invoice = await paymentService.createInvoice(user, {
      branchId: seed.branchId,
      studentId: seed.studentId,
      feePlanId: String((plan as { _id: string })._id),
      dueDate,
    });
    await paymentService.collectPayment(user, {
      invoiceId: String((invoice as { _id: string })._id),
      amount: 2200,
      method: 'CASH',
      skipMembershipExtension: true,
    });
    const config = resolvePartialPlanConfig(plan as never);
    await applyPartialPlanOnMembership({
      membershipId: (membership as { _id: string })._id,
      feePlan: plan as never,
      config,
      invoiceAmount: 11000,
      paidAmount: 2200,
      startDate: start,
      selectedDurationDays: 180,
      invoiceId: (invoice as { _id: string })._id,
      downgradeDueDate: dueDate,
    });
    await MembershipModel.updateOne(
      { _id: (membership as { _id: string })._id },
      { $set: { invoiceId: (invoice as { _id: string })._id } },
    );
    const inv = await InvoiceModel.findById((invoice as { _id: string })._id).lean();
    expect(inv?.status).toBe('PARTIAL');
    expect(inv?.dueAmount).toBe(8800);
    const row = await MembershipModel.findById((membership as { _id: string })._id).lean();
    expect(row?.downgradeStatus).toBe(DOWNGRADE_STATUS.PENDING);
    expect(row?.pendingUpgradeAmount).toBe(8800);
  });

  it('unpaid after due downgrades to 1 month', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    const plan = await createSixMonthPlan(seed, user);
    const start = new Date('2026-01-01');
    const dueDate = new Date('2026-01-05');
    const membership = await MembershipModel.create({
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      shiftId: new mongoose.Types.ObjectId(seed.shiftId),
      seatId: null,
      membershipType: 'FULL_DAY',
      startDate: start,
      endDate: addDays(start, 180),
      durationDays: 180,
      status: 'ACTIVE',
      feePlanId: new mongoose.Types.ObjectId(String((plan as { _id: string })._id)),
      downgradeStatus: DOWNGRADE_STATUS.PENDING,
      downgradeDueDate: dueDate,
      selectedPlanDurationDays: 180,
      effectiveDurationDays: 180,
      originalEndDate: addDays(start, 180),
      effectiveEndDate: addDays(start, 180),
      fullPaymentRequiredAmount: 11000,
      paidBeforeDowngrade: 2200,
      pendingUpgradeAmount: 8800,
    });
    const invoice = await InvoiceModel.create({
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      seatId: null,
      feePlanId: new mongoose.Types.ObjectId(String((plan as { _id: string })._id)),
      invoiceNumber: `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      amount: 11000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 11000,
      paidAmount: 2200,
      refundTotal: 0,
      dueAmount: 8800,
      status: 'PARTIAL',
      dueDate,
      membershipId: membership._id,
      downgradeIfUnpaid: true,
      downgradeDueDate: dueDate,
      selectedDurationDays: 180,
      downgradeDurationDays: 30,
      currency: 'INR',
    });
    membership.invoiceId = invoice._id as mongoose.Types.ObjectId;
    await membership.save();

    const count = await processPendingMembershipDowngrades(new Date('2026-01-10'));
    expect(count).toBe(1);
    const updated = await MembershipModel.findById(membership._id).lean();
    expect(updated?.downgradeStatus).toBe(DOWNGRADE_STATUS.COMPLETED);
    expect(updated?.effectiveDurationDays).toBe(30);
    expect(updated?.downgradeReason).toContain('not paid');
    const student = await StudentModel.findById(seed.studentId).lean();
    expect(student?.membershipEndDate).toBeTruthy();
    const end = new Date(student!.membershipEndDate!);
    const expectedEnd = addDays(start, 30);
    expect(Math.abs(end.getTime() - expectedEnd.getTime())).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it('paid before due prevents downgrade', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    const plan = await createSixMonthPlan(seed, user);
    const start = new Date('2026-06-01');
    const dueDate = new Date('2026-06-15');
    const membership = await MembershipModel.create({
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      shiftId: null,
      seatId: null,
      membershipType: 'FULL_DAY',
      startDate: start,
      endDate: addDays(start, 180),
      durationDays: 180,
      status: 'ACTIVE',
      downgradeStatus: DOWNGRADE_STATUS.PENDING,
      downgradeDueDate: dueDate,
      selectedPlanDurationDays: 180,
      originalEndDate: addDays(start, 180),
      effectiveEndDate: addDays(start, 180),
    });
    const invoice = await InvoiceModel.create({
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      seatId: null,
      feePlanId: null,
      invoiceNumber: `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      amount: 11000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 11000,
      paidAmount: 2200,
      refundTotal: 0,
      dueAmount: 8800,
      status: 'PARTIAL',
      dueDate,
      membershipId: membership._id,
      currency: 'INR',
    });
    membership.invoiceId = invoice._id as mongoose.Types.ObjectId;
    await membership.save();

    invoice.paidAmount = 11000;
    invoice.dueAmount = 0;
    invoice.status = 'PAID';
    await invoice.save();
    await resolveDowngradeOnInvoicePayment(invoice._id);

    const updated = await MembershipModel.findById(membership._id).lean();
    expect(updated?.downgradeStatus).toBe(DOWNGRADE_STATUS.NOT_REQUIRED);
    expect(new Date(updated!.effectiveEndDate!).getTime()).toBe(addDays(start, 180).getTime());
  });

  it('paid after downgrade does not auto-restore', async () => {
    const seed = await seedPartialTenant();
    const start = new Date('2026-01-01');
    const membership = await MembershipModel.create({
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      shiftId: null,
      seatId: null,
      membershipType: 'FULL_DAY',
      startDate: start,
      endDate: addDays(start, 30),
      durationDays: 30,
      status: 'ACTIVE',
      downgradeStatus: DOWNGRADE_STATUS.COMPLETED,
      downgradeReason: 'Remaining amount not paid by due date',
      selectedPlanDurationDays: 180,
      effectiveDurationDays: 30,
      originalEndDate: addDays(start, 180),
      effectiveEndDate: addDays(start, 30),
    });
    const invoice = await InvoiceModel.create({
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      seatId: null,
      feePlanId: null,
      invoiceNumber: `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      amount: 11000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 11000,
      paidAmount: 2200,
      refundTotal: 0,
      dueAmount: 8800,
      status: 'PARTIAL',
      dueDate: new Date('2026-01-05'),
      membershipId: membership._id,
      currency: 'INR',
    });
    membership.invoiceId = invoice._id as mongoose.Types.ObjectId;
    await membership.save();

    invoice.paidAmount = 11000;
    invoice.dueAmount = 0;
    invoice.status = 'PAID';
    await invoice.save();
    await resolveDowngradeOnInvoicePayment(invoice._id);

    const updated = await MembershipModel.findById(membership._id).lean();
    expect(updated?.downgradeStatus).toBe(DOWNGRADE_STATUS.COMPLETED);
    expect(updated?.effectiveDurationDays).toBe(30);
  });

  it('listForStudent includes downgrade pending info', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    const start = new Date('2026-06-01');
    const dueDate = new Date('2026-06-08');
    const invoice = await InvoiceModel.create({
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      seatId: null,
      feePlanId: null,
      invoiceNumber: `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      amount: 11000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 11000,
      paidAmount: 2200,
      refundTotal: 0,
      dueAmount: 8800,
      status: 'PARTIAL',
      dueDate,
      currency: 'INR',
    });
    await MembershipModel.create({
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      shiftId: null,
      seatId: null,
      membershipType: 'FULL_DAY',
      startDate: start,
      endDate: addDays(start, 180),
      durationDays: 180,
      status: 'ACTIVE',
      invoiceId: invoice._id,
      downgradeStatus: DOWNGRADE_STATUS.PENDING,
      downgradeDueDate: dueDate,
      selectedPlanDurationDays: 180,
      pendingUpgradeAmount: 8800,
    });
    const items = await membershipService.listForStudent(user, seed.studentId);
    expect(items[0]?.downgradeStatus).toBe(DOWNGRADE_STATUS.PENDING);
    expect((items[0] as { linkedInvoice?: { dueAmount: number } }).linkedInvoice?.dueAmount).toBe(8800);
  });

  it('dues filter shows downgrade pending invoices', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    await InvoiceModel.create({
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      seatId: null,
      feePlanId: null,
      invoiceNumber: `INV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      amount: 11000,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 11000,
      paidAmount: 2200,
      refundTotal: 0,
      dueAmount: 8800,
      status: 'PARTIAL',
      dueDate: new Date('2026-06-08'),
      downgradeIfUnpaid: true,
      downgradeDueDate: new Date('2026-06-08'),
      selectedDurationDays: 180,
      currency: 'INR',
    });
    const result = await paymentService.listDues(user, {
      page: 1,
      limit: 20,
      downgradePending: true,
    });
    expect(result.items.length).toBe(1);
  });

  it('blocks collect payment below minimum for long-duration plan', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    const plan = await createSixMonthPlan(seed, user);
    const dueDate = new Date('2026-12-15');
    const invoice = await paymentService.createInvoice(user, {
      branchId: seed.branchId,
      studentId: seed.studentId,
      feePlanId: String((plan as { _id: string })._id),
      dueDate,
    });
    await expect(
      paymentService.collectPayment(user, {
        invoiceId: String((invoice as { _id: string })._id),
        amount: 500,
        method: 'CASH',
        skipMembershipExtension: true,
      }),
    ).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('Minimum payment required'),
    });
  });

  it('allows collect payment equal to minimum', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    const plan = await createSixMonthPlan(seed, user);
    const dueDate = new Date('2026-12-15');
    const invoice = await paymentService.createInvoice(user, {
      branchId: seed.branchId,
      studentId: seed.studentId,
      feePlanId: String((plan as { _id: string })._id),
      dueDate,
    });
    const result = await paymentService.collectPayment(user, {
      invoiceId: String((invoice as { _id: string })._id),
      amount: 2200,
      method: 'CASH',
      skipMembershipExtension: true,
    });
    expect((result.invoice as { status: string }).status).toBe('PARTIAL');
    expect((result.invoice as { paidAmount: number }).paidAmount).toBe(2200);
  });

  it('allows unpaid invoice creation without collecting payment', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    const plan = await createSixMonthPlan(seed, user);
    const invoice = await paymentService.createInvoice(user, {
      branchId: seed.branchId,
      studentId: seed.studentId,
      feePlanId: String((plan as { _id: string })._id),
      dueDate: new Date('2026-12-15'),
      status: 'UNPAID',
    });
    expect((invoice as { status: string }).status).toBe('UNPAID');
    expect((invoice as { paidAmount: number }).paidAmount).toBe(0);
    expect((invoice as { partialMinimumAmount: number }).partialMinimumAmount).toBe(2200);
  });

  it('listForStudent omits partial flags for normal monthly membership', async () => {
    const seed = await seedPartialTenant();
    const user = staff(seed.staffId, seed.libraryId, seed.branchId);
    await MembershipModel.create({
      studentId: new mongoose.Types.ObjectId(seed.studentId),
      libraryId: new mongoose.Types.ObjectId(seed.libraryId),
      branchId: new mongoose.Types.ObjectId(seed.branchId),
      shiftId: null,
      seatId: null,
      membershipType: 'FULL_DAY',
      startDate: new Date('2026-06-01'),
      endDate: addDays(new Date('2026-06-01'), 30),
      durationDays: 30,
      status: 'ACTIVE',
      downgradeStatus: DOWNGRADE_STATUS.NONE,
    });
    const items = await membershipService.listForStudent(user, seed.studentId);
    expect(items[0]?.downgradeStatus).toBe(DOWNGRADE_STATUS.NONE);
    expect((items[0] as { allowPartialStart?: boolean }).allowPartialStart).toBeUndefined();
  });
});
