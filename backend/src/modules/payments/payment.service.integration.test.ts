import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { HTTP_STATUS } from '@constants/http.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { DEFAULT_TIMEZONE, LIBRARY_STATUS, SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { STUDENT_STATUS } from '@modules/students/student.constants';

import { FeePlanModel, InvoiceModel, PaymentRecordModel, RefundModel } from './payments.models';
import { paymentService } from './payment.service';

const ALL_PAYMENT_PERMS = [
  PERMISSIONS.FEE_PLAN_CREATE,
  PERMISSIONS.FEE_PLAN_READ,
  PERMISSIONS.PAYMENT_CREATE,
  PERMISSIONS.PAYMENT_READ,
  PERMISSIONS.PAYMENT_UPDATE,
  PERMISSIONS.PAYMENT_DELETE,
  PERMISSIONS.PAYMENT_REFUND,
  PERMISSIONS.PAYMENT_SUMMARY,
] as const;

function staff(
  id: string,
  libraryId: string,
  branchId: string | null,
  permissions: AuthenticatedUser['permissions'],
): AuthenticatedUser {
  return {
    id,
    role: ROLES.ACCOUNTANT,
    permissions: [...permissions],
    libraryId,
    branchId,
  };
}

type Seed = {
  libraryId: string;
  branchId: string;
  branch2Id: string;
  studentId: string;
  studentUserId: string;
  otherStudentId: string;
  staffId: string;
};

async function seedTenant(): Promise<Seed> {
  const suffix = crypto.randomBytes(8).toString('hex');
  const lib = await LibraryModel.create({
    name: `Pay Test Lib ${suffix}`,
    slug: `pay-lib-${suffix}`,
    email: `pay-lib-${suffix}@example.com`,
    timezone: DEFAULT_TIMEZONE,
    subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
    status: LIBRARY_STATUS.ACTIVE,
    settings: {},
  });
  const libId = lib._id as mongoose.Types.ObjectId;

  const branch = await BranchModel.create({
    libraryId: libId,
    branchName: `Branch A ${suffix}`,
    branchCode: `PA${suffix.slice(0, 6)}`.toUpperCase(),
    email: `br-a-${suffix}@example.com`,
    totalSeats: 40,
    active: true,
  });
  const branch2 = await BranchModel.create({
    libraryId: libId,
    branchName: `Branch B ${suffix}`,
    branchCode: `PB${suffix.slice(0, 6)}`.toUpperCase(),
    email: `br-b-${suffix}@example.com`,
    totalSeats: 20,
    active: true,
  });

  const studentUserId = new mongoose.Types.ObjectId().toString();
  const staffId = new mongoose.Types.ObjectId().toString();

  const st = await StudentModel.create({
    libraryId: libId,
    branchId: branch._id,
    studentId: `STU-${suffix}`,
    fullName: 'Pay Test Student',
    email: `stu-${suffix}@example.com`,
    admissionDate: new Date('2026-01-01'),
    membershipStartDate: new Date('2026-01-01'),
    status: STUDENT_STATUS.ACTIVE,
    userId: new mongoose.Types.ObjectId(studentUserId),
  });

  const st2 = await StudentModel.create({
    libraryId: libId,
    branchId: branch2._id,
    studentId: `STU2-${suffix}`,
    fullName: 'Other Branch Student',
    email: `stu2-${suffix}@example.com`,
    admissionDate: new Date('2026-01-01'),
    membershipStartDate: new Date('2026-01-01'),
    status: STUDENT_STATUS.ACTIVE,
    userId: null,
  });

  return {
    libraryId: String(libId),
    branchId: String(branch._id),
    branch2Id: String(branch2._id),
    studentId: String(st._id),
    studentUserId,
    otherStudentId: String(st2._id),
    staffId,
  };
}

async function seedOtherLibraryBranch(): Promise<{ libraryId: string; branchId: string }> {
  const suffix = crypto.randomBytes(6).toString('hex');
  const lib = await LibraryModel.create({
    name: `Other Lib ${suffix}`,
    slug: `other-lib-${suffix}`,
    email: `other-lib-${suffix}@example.com`,
    timezone: DEFAULT_TIMEZONE,
    subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
    status: LIBRARY_STATUS.ACTIVE,
    settings: {},
  });
  const b = await BranchModel.create({
    libraryId: lib._id,
    branchName: `Other Branch ${suffix}`,
    branchCode: `OB${suffix.slice(0, 6)}`.toUpperCase(),
    email: `ob-${suffix}@example.com`,
    totalSeats: 10,
    active: true,
  });
  return { libraryId: String(lib._id), branchId: String(b._id) };
}

async function wipePaymentData(): Promise<void> {
  await Promise.all([
    RefundModel.deleteMany({}),
    PaymentRecordModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    FeePlanModel.deleteMany({}),
    StudentModel.deleteMany({}),
    BranchModel.deleteMany({}),
    LibraryModel.deleteMany({}),
  ]);
}

describe('payment.service integration', { timeout: 60_000 }, () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await wipePaymentData();
  });

  it('creates fee plan and rejects foreign-library branch', async () => {
    const t = await seedTenant();
    const other = await seedOtherLibraryBranch();
    const u = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);

    const plan = await paymentService.createFeePlan(u, {
      branchId: t.branchId,
      name: 'Monthly',
      amount: 1200,
      durationDays: 30,
    });
    expect(plan.name).toBe('Monthly');
    expect(Number(plan.amount)).toBe(1200);

    await expect(
      paymentService.createFeePlan(u, {
        branchId: other.branchId,
        name: 'Bad',
        amount: 1,
        durationDays: 1,
      }),
    ).rejects.toMatchObject({
      statusCode: HTTP_STATUS.FORBIDDEN,
    });
  });

  it('creates invoice from fee plan and from explicit amount', async () => {
    const t = await seedTenant();
    const u = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);

    const plan = await paymentService.createFeePlan(u, {
      branchId: t.branchId,
      name: 'Plan',
      amount: 500,
      durationDays: 30,
    });

    const invFromPlan = await paymentService.createInvoice(u, {
      branchId: t.branchId,
      studentId: t.studentId,
      feePlanId: String(plan._id),
      dueDate: new Date('2026-06-01'),
      status: 'UNPAID',
    });
    expect(invFromPlan.status).toBe('UNPAID');
    expect(Number(invFromPlan.totalAmount)).toBe(500);

    const invExplicit = await paymentService.createInvoice(u, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 250,
      discountAmount: 0,
      taxAmount: 0,
      dueDate: new Date('2026-06-15'),
    });
    expect(Number(invExplicit.totalAmount)).toBe(250);
  });

  it('records partial then full payment and updates invoice status', async () => {
    const t = await seedTenant();
    const u = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);

    const inv = await paymentService.createInvoice(u, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 100,
      dueDate: new Date('2026-12-31'),
    });

    const p1 = await paymentService.collectPayment(u, {
      invoiceId: String(inv._id),
      amount: 40,
      method: 'CASH',
    });
    expect(p1.invoice.status).toBe('PARTIAL');
    expect(Number(p1.invoice.dueAmount)).toBe(60);

    const p2 = await paymentService.collectPayment(u, {
      invoiceId: String(inv._id),
      amount: 60,
      method: 'UPI',
    });
    expect(p2.invoice.status).toBe('PAID');
    expect(Number(p2.invoice.dueAmount)).toBe(0);
  });

  it('prevents overpayment unless allowed and permitted', async () => {
    const t = await seedTenant();
    const fullPerms = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);
    const createOnly = staff(new mongoose.Types.ObjectId().toString(), t.libraryId, t.branchId, [
      PERMISSIONS.PAYMENT_CREATE,
    ]);

    const inv = await paymentService.createInvoice(fullPerms, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 100,
      dueDate: new Date('2026-12-31'),
    });
    const id = String(inv._id);

    await expect(
      paymentService.collectPayment(fullPerms, {
        invoiceId: id,
        amount: 100.5,
        method: 'CASH',
      }),
    ).rejects.toMatchObject({
      statusCode: HTTP_STATUS.BAD_REQUEST,
      message: expect.stringContaining('exceeds'),
    });

    await expect(
      paymentService.collectPayment(createOnly, {
        invoiceId: id,
        amount: 200,
        method: 'CASH',
        allowOverpayment: true,
      }),
    ).rejects.toMatchObject({
      statusCode: HTTP_STATUS.FORBIDDEN,
    });

    const ok = await paymentService.collectPayment(fullPerms, {
      invoiceId: id,
      amount: 200,
      method: 'CASH',
      allowOverpayment: true,
    });
    expect(ok.invoice.status).toBe('PAID');
  });

  it('enforces tenant isolation on collect and list', async () => {
    const t = await seedTenant();
    const other = await seedOtherLibraryBranch();
    const u = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);
    const intruder = staff(new mongoose.Types.ObjectId().toString(), other.libraryId, other.branchId, [
      ...ALL_PAYMENT_PERMS,
    ]);

    const inv = await paymentService.createInvoice(u, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 50,
      dueDate: new Date('2026-12-31'),
    });

    await expect(
      paymentService.collectPayment(intruder, {
        invoiceId: String(inv._id),
        amount: 50,
        method: 'CASH',
      }),
    ).rejects.toMatchObject({ statusCode: HTTP_STATUS.FORBIDDEN });

    const listed = await paymentService.listInvoices(intruder, {
      page: 1,
      limit: 20,
    });
    expect(listed.items.some((row) => String(row._id) === String(inv._id))).toBe(false);
  });

  it('restricts branch-scoped staff to their branch invoices', async () => {
    const t = await seedTenant();
    const libWideId = new mongoose.Types.ObjectId().toString();
    const libWide = staff(libWideId, t.libraryId, null, [...ALL_PAYMENT_PERMS]);

    await paymentService.createInvoice(libWide, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 10,
      dueDate: new Date('2026-12-31'),
    });

    const invB = await paymentService.createInvoice(libWide, {
      branchId: t.branch2Id,
      studentId: t.otherStudentId,
      amount: 20,
      dueDate: new Date('2026-12-31'),
    });

    const branchUser = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);
    const res = await paymentService.listInvoices(branchUser, { page: 1, limit: 50 });
    expect(res.items.some((i) => String(i._id) === String(invB._id))).toBe(false);
  });

  it('student can read own portal, history, and receipt; not another student', async () => {
    const t = await seedTenant();
    const staffUser = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);
    const inv = await paymentService.createInvoice(staffUser, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 80,
      dueDate: new Date('2026-12-31'),
    });
    const paid = await paymentService.collectPayment(staffUser, {
      invoiceId: String(inv._id),
      amount: 80,
      method: 'CARD',
    });

    const studentAuth: AuthenticatedUser = {
      id: t.studentUserId,
      role: ROLES.STUDENT,
      permissions: [PERMISSIONS.PAYMENT_READ],
      libraryId: t.libraryId,
      branchId: t.branchId,
    };

    const wallet = await paymentService.getStudentPortalWallet(studentAuth);
    expect(wallet.studentId).toBe(t.studentId);
    expect(wallet.invoices.length).toBeGreaterThanOrEqual(1);

    const hist = await paymentService.studentHistory(studentAuth, t.studentId);
    expect(hist.payments.length).toBeGreaterThanOrEqual(1);

    await expect(paymentService.studentHistory(studentAuth, t.otherStudentId)).rejects.toMatchObject({
      statusCode: HTTP_STATUS.FORBIDDEN,
    });

    const receipt = await paymentService.getReceipt(studentAuth, String(paid.payment._id));
    expect(receipt.payment).toBeTruthy();

    const otherStudentAuth: AuthenticatedUser = {
      id: new mongoose.Types.ObjectId().toString(),
      role: ROLES.STUDENT,
      permissions: [PERMISSIONS.PAYMENT_READ],
      libraryId: t.libraryId,
      branchId: t.branch2Id,
    };
    await StudentModel.findByIdAndUpdate(t.otherStudentId, {
      userId: new mongoose.Types.ObjectId(otherStudentAuth.id),
    });

    await expect(
      paymentService.getReceipt(otherStudentAuth, String(paid.payment._id)),
    ).rejects.toMatchObject({ statusCode: HTTP_STATUS.FORBIDDEN });
  });

  it('marks invoice OVERDUE via getInvoice recalculation', async () => {
    const t = await seedTenant();
    const u = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);
    const inv = await paymentService.createInvoice(u, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 33,
      dueDate: new Date('2020-01-01'),
    });
    const refreshed = await paymentService.getInvoice(u, String(inv._id));
    expect(refreshed.status).toBe('OVERDUE');
  });

  it('allows cancelling unpaid invoice via updateInvoice', async () => {
    const t = await seedTenant();
    const u = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);
    const inv = await paymentService.createInvoice(u, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 15,
      dueDate: new Date('2026-12-31'),
    });
    const updated = await paymentService.updateInvoice(u, String(inv._id), { status: 'CANCELLED' });
    expect(updated.status).toBe('CANCELLED');
  });

  it('rejects student querying another student id on invoice list', async () => {
    const t = await seedTenant();
    const libWideId = new mongoose.Types.ObjectId().toString();
    const libWide = staff(libWideId, t.libraryId, null, [...ALL_PAYMENT_PERMS]);
    await paymentService.createInvoice(libWide, {
      branchId: t.branch2Id,
      studentId: t.otherStudentId,
      amount: 5,
      dueDate: new Date('2026-12-31'),
    });

    const studentAuth: AuthenticatedUser = {
      id: t.studentUserId,
      role: ROLES.STUDENT,
      permissions: [PERMISSIONS.PAYMENT_READ],
      libraryId: t.libraryId,
      branchId: t.branchId,
    };

    await expect(
      paymentService.listInvoices(studentAuth, {
        page: 1,
        limit: 20,
        studentId: t.otherStudentId,
      }),
    ).rejects.toMatchObject({ statusCode: HTTP_STATUS.FORBIDDEN });
  });

  it('enriches dues and invoice detail responses with display fields', async () => {
    const t = await seedTenant();
    const staffUser = staff(t.staffId, t.libraryId, t.branchId, [...ALL_PAYMENT_PERMS]);
    const inv = await paymentService.createInvoice(staffUser, {
      branchId: t.branchId,
      studentId: t.studentId,
      amount: 150,
      dueDate: new Date('2026-12-31'),
    });

    const dues = await paymentService.listDues(staffUser, { page: 1, limit: 20 });
    const row = dues.items.find((item) => String(item._id) === String(inv._id)) as Record<string, unknown>;
    expect(row?.studentName).toBe('Pay Test Student');
    expect(row?.studentCode).toBeTruthy();

    const detail = (await paymentService.getInvoice(staffUser, String(inv._id))) as Record<string, unknown>;
    expect(detail.studentName).toBe('Pay Test Student');
    expect(detail.branchName).toBeTruthy();
  });
});
