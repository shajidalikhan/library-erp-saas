import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { AttendanceModel } from '@modules/attendance/attendance.model';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { DEFAULT_TIMEZONE, LIBRARY_STATUS, SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { PaymentRecordModel } from '@modules/payments/payment-record.model';
import { StudentModel } from '@modules/students/students.models';
import { STUDENT_STATUS } from '@modules/students/student.constants';

import { mimeTypeForExportFormat } from './reports-export.util';
import { reportsService } from './reports.service';

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

function accountantOf(libraryId: string): AuthenticatedUser {
  return {
    id: new mongoose.Types.ObjectId().toString(),
    role: ROLES.ACCOUNTANT,
    permissions: ROLE_PERMISSIONS_ACCOUNTANT,
    libraryId,
    branchId: null,
  };
}

const ROLE_PERMISSIONS_ACCOUNTANT: AuthenticatedUser['permissions'] = [
  PERMISSIONS.STUDENT_READ,
  PERMISSIONS.SEAT_READ,
  PERMISSIONS.PAYMENT_READ,
  PERMISSIONS.PAYMENT_CREATE,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.ANALYTICS_VIEW,
];

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
    AttendanceModel.deleteMany({}),
    PaymentRecordModel.deleteMany({}),
    InvoiceModel.deleteMany({}),
    StudentModel.deleteMany({}),
    BranchModel.deleteMany({}),
    LibraryModel.deleteMany({}),
  ]);
});

async function seedLibBranchStudent(suffix: string) {
  const lib = await LibraryModel.create({
    name: `Lib ${suffix}`,
    slug: `lib-${suffix}`,
    email: `lib-${suffix}@ex.com`,
    timezone: DEFAULT_TIMEZONE,
    subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
    status: LIBRARY_STATUS.ACTIVE,
    settings: {},
  });
  const br = await BranchModel.create({
    libraryId: lib._id,
    branchName: 'Main',
    branchCode: `MN${suffix.slice(0, 4)}`.toUpperCase(),
    email: `br-${suffix}@ex.com`,
    totalSeats: 20,
    active: true,
  });
  const stu = await StudentModel.create({
    libraryId: lib._id,
    branchId: br._id,
    studentId: `ST-${suffix}`,
    fullName: 'Report Student',
    email: `stu-${suffix}@ex.com`,
    admissionDate: new Date(),
    membershipStartDate: new Date(),
    status: STUDENT_STATUS.ACTIVE,
    assignedSeatId: null,
    userId: null,
  });
  return { lib, br, stu };
}

describe('reports.service', () => {
  it('tenant isolation on student report', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const a = await seedLibBranchStudent(`a-${suffix}`);
    const b = await seedLibBranchStudent(`b-${suffix}`);
    const ownerA = ownerOf(String(a.lib._id), null);
    const listA = await reportsService.listStudents(ownerA, { range: '30d', page: 1, limit: 50 });
    expect(listA.items.some((x) => String(x._id) === String(a.stu._id))).toBe(true);
    expect(listA.items.some((x) => String(x._id) === String(b.stu._id))).toBe(false);
  });

  it('accountant cannot load operational student report', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const { lib } = await seedLibBranchStudent(`acc-${suffix}`);
    const acc = accountantOf(String(lib._id));
    await expect(reportsService.listStudents(acc, { range: '30d', page: 1, limit: 10 })).rejects.toThrow(
      /not available for the accountant role/i,
    );
  });

  it('accountant can load payment report when data exists', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const { lib, br, stu } = await seedLibBranchStudent(`pay-${suffix}`);
    const inv = await InvoiceModel.create({
      libraryId: lib._id,
      branchId: br._id,
      studentId: stu._id,
      seatId: null,
      feePlanId: null,
      invoiceNumber: `INV-${suffix}`,
      amount: 50,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 50,
      paidAmount: 50,
      refundTotal: 0,
      dueAmount: 0,
      status: 'PAID',
      dueDate: new Date(),
      currency: 'INR',
    });
    const paidAt = new Date('2026-01-15T12:00:00.000Z');
    await PaymentRecordModel.create({
      libraryId: lib._id,
      branchId: br._id,
      studentId: stu._id,
      invoiceId: inv._id,
      amount: 50,
      method: 'CASH',
      receiptNumber: `RC-${suffix}`,
      receivedBy: new mongoose.Types.ObjectId(),
      paidAt,
      status: 'ACTIVE',
      refundedAmount: 0,
    });
    const acc = accountantOf(String(lib._id));
    const inRange = await reportsService.listPayments(acc, {
      range: 'custom',
      fromDate: new Date('2026-01-01'),
      toDate: new Date('2026-01-31'),
      page: 1,
      limit: 20,
    });
    expect(inRange.items.length).toBe(1);
    const outRange = await reportsService.listPayments(acc, {
      range: 'custom',
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-01-31'),
      page: 1,
      limit: 20,
    });
    expect(outRange.items.length).toBe(0);
  });

  it('student report branch filter returns only selected branch students', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const { lib, br, stu } = await seedLibBranchStudent(`brf-${suffix}`);
    const br2 = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Second',
      branchCode: `S2${suffix.slice(0, 3)}`.toUpperCase(),
      email: `br2-${suffix}@ex.com`,
      totalSeats: 10,
      active: true,
    });
    await StudentModel.create({
      libraryId: lib._id,
      branchId: br2._id,
      studentId: `ST2-${suffix}`,
      fullName: 'Other Branch Student',
      email: `stu2-${suffix}@ex.com`,
      admissionDate: new Date(),
      membershipStartDate: new Date(),
      status: STUDENT_STATUS.ACTIVE,
      assignedSeatId: null,
      userId: null,
    });
    const owner = ownerOf(String(lib._id), null);
    const filtered = await reportsService.listStudents(owner, {
      range: '30d',
      branchId: String(br._id),
      page: 1,
      limit: 50,
    });
    expect(filtered.items.some((x) => String(x._id) === String(stu._id))).toBe(true);
    expect(filtered.items.every((x) => String(x.branchId) === String(br._id))).toBe(true);
  });

  it('export students returns csv buffer without mongo ids', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const { lib } = await seedLibBranchStudent(`csv-${suffix}`);
    const owner = ownerOf(String(lib._id), null);
    const { body, format } = await reportsService.exportStudents(owner, {
      range: '30d',
      format: 'csv',
      page: 1,
      limit: 20,
    });
    expect(mimeTypeForExportFormat(format)).toBe('text/csv');
    const csv = body.toString('utf-8');
    expect(csv).toContain('Student Name');
    expect(csv).not.toMatch(/libraryId/i);
    expect(csv).not.toMatch(/_id/);
  });

  it('export students returns pdf buffer', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const { lib } = await seedLibBranchStudent(`pdf-${suffix}`);
    const owner = ownerOf(String(lib._id), null);
    const { body, format } = await reportsService.exportStudents(owner, {
      range: '30d',
      format: 'pdf',
      page: 1,
      limit: 20,
    });
    expect(mimeTypeForExportFormat(format)).toBe('application/pdf');
    expect(body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('export payments returns xlsx buffer', async () => {
    const suffix = crypto.randomBytes(4).toString('hex');
    const { lib, br, stu } = await seedLibBranchStudent(`xlsx-${suffix}`);
    const inv = await InvoiceModel.create({
      libraryId: lib._id,
      branchId: br._id,
      studentId: stu._id,
      seatId: null,
      feePlanId: null,
      invoiceNumber: `INVX-${suffix}`,
      amount: 10,
      discountAmount: 0,
      taxAmount: 0,
      totalAmount: 10,
      paidAmount: 10,
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
      amount: 10,
      method: 'UPI',
      receiptNumber: `RX-${suffix}`,
      receivedBy: new mongoose.Types.ObjectId(),
      paidAt: new Date(),
      status: 'ACTIVE',
      refundedAmount: 0,
    });
    const acc = accountantOf(String(lib._id));
    const { body, format } = await reportsService.exportPayments(acc, { range: '30d', format: 'xlsx', page: 1, limit: 20 });
    expect(mimeTypeForExportFormat(format)).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(body.length).toBeGreaterThan(100);
  });
});
