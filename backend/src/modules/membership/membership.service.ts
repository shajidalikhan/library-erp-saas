import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS, type PermissionName } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { StudentModel } from '@modules/students/students.models';
import { FeePlanModel } from '@modules/payments/payments.models';
import type { IFeePlanDocument } from '@modules/payments/fee-plan.model';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { STUDENT_STATUS } from '@modules/students/student.constants';
import {
  membershipExpiredReleaseOptions,
  MEMBERSHIP_EXPIRED_RELEASE_REASON,
  releaseStudentSeatsWithAudit,
} from '@modules/students/student-seat-release.service';

import { MembershipModel } from './membership.model';
import { MEMBERSHIP_STATUS, type MembershipStatus } from './membership.constants';
import {
  buildDashboardCountFilters,
  getMembershipDateBounds,
} from '@modules/students/membership-query.util';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

export function computeMembershipStatus(startDate: Date, endDate: Date, now = new Date()): MembershipStatus {
  if (startDate.getTime() > now.getTime()) return MEMBERSHIP_STATUS.UPCOMING;
  if (endDate.getTime() < now.getTime()) return MEMBERSHIP_STATUS.EXPIRED;
  return MEMBERSHIP_STATUS.ACTIVE;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function syncStudentMembershipDates(
  studentId: Types.ObjectId | string,
  startDate: Date,
  endDate: Date,
): Promise<void> {
  const status = computeMembershipStatus(startDate, endDate);
  const studentStatus =
    status === MEMBERSHIP_STATUS.EXPIRED ? STUDENT_STATUS.SUSPENDED : STUDENT_STATUS.ACTIVE;

  const existing = await StudentModel.findById(studentId).select('status assignedSeatId').lean();
  const wasActive = existing?.status === STUDENT_STATUS.ACTIVE;
  const becomingSuspended =
    studentStatus === STUDENT_STATUS.SUSPENDED && wasActive;

  await StudentModel.updateOne(
    { _id: studentId },
    {
      $set: {
        membershipStartDate: startDate,
        membershipEndDate: endDate,
        status: studentStatus,
      },
    },
  );

  if (becomingSuspended) {
    await releaseStudentSeatsWithAudit({
      studentId: String(studentId),
      reason: MEMBERSHIP_EXPIRED_RELEASE_REASON,
      actorUserId: null,
      releaseOptions: membershipExpiredReleaseOptions,
    });
  }
}

/** Suspends active students past membership end date and releases their seats. */
export async function processExpiredMembershipStudents(now = new Date()): Promise<number> {
  const expired = await StudentModel.find({
    status: STUDENT_STATUS.ACTIVE,
    membershipEndDate: { $lt: now },
  })
    .select('_id')
    .lean();

  let processed = 0;
  for (const row of expired) {
    const student = await StudentModel.findById(row._id).select('membershipStartDate membershipEndDate');
    if (!student?.membershipStartDate || !student.membershipEndDate) continue;
    await syncStudentMembershipDates(
      student._id,
      new Date(student.membershipStartDate),
      new Date(student.membershipEndDate),
    );
    processed += 1;
  }
  return processed;
}

class MembershipService {
  private assertCan(user: AuthenticatedUser, perm: PermissionName): void {
    if (user.role === ROLES.SUPER_ADMIN) return;
    if (!user.permissions.includes(perm)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
  }

  async createMembership(
    user: AuthenticatedUser,
    input: {
      studentId: string;
      libraryId: string;
      branchId: string;
      shiftId?: string | null;
      seatId?: string | null;
      membershipType: string;
      startDate: Date;
      durationDays: number;
      feePlanId?: string | null;
      invoiceId?: string | null;
      paymentId?: string | null;
    },
  ) {
    this.assertCan(user, PERMISSIONS.MEMBERSHIP_CREATE);
    const endDate = addDays(input.startDate, input.durationDays);
    const status = computeMembershipStatus(input.startDate, endDate);

    const membership = await MembershipModel.create({
      studentId: new Types.ObjectId(input.studentId),
      libraryId: new Types.ObjectId(input.libraryId),
      branchId: new Types.ObjectId(input.branchId),
      shiftId: input.shiftId ? new Types.ObjectId(input.shiftId) : null,
      seatId: input.seatId ? new Types.ObjectId(input.seatId) : null,
      membershipType: input.membershipType,
      startDate: input.startDate,
      endDate,
      durationDays: input.durationDays,
      status,
      feePlanId: input.feePlanId ? new Types.ObjectId(input.feePlanId) : null,
      invoiceId: input.invoiceId ? new Types.ObjectId(input.invoiceId) : null,
      paymentId: input.paymentId ? new Types.ObjectId(input.paymentId) : null,
    });

    await syncStudentMembershipDates(input.studentId, input.startDate, endDate);
    return toJSON(membership.toObject());
  }

  /**
   * Extends membership when payment is collected.
   * If expired → start today; if active → extend from current endDate.
   */
  async extendFromPayment(input: {
    studentId: Types.ObjectId;
    libraryId: Types.ObjectId;
    branchId: Types.ObjectId;
    invoiceId: Types.ObjectId;
    paymentId: Types.ObjectId;
    durationDays: number;
    membershipType?: string;
    shiftId?: Types.ObjectId | null;
    seatId?: Types.ObjectId | null;
    feePlanId?: Types.ObjectId | null;
  }): Promise<void> {
    const student = await StudentModel.findById(input.studentId);
    if (!student) return;

    const now = new Date();
    const currentEnd = student.membershipEndDate ? new Date(student.membershipEndDate) : null;
    const expired = !currentEnd || currentEnd.getTime() < now.getTime();

    const startDate = expired
      ? now
      : student.membershipStartDate
        ? new Date(student.membershipStartDate)
        : now;
    const baseEnd = expired ? now : currentEnd!;
    const endDate = addDays(baseEnd, input.durationDays);

    await MembershipModel.updateMany(
      { studentId: input.studentId, status: MEMBERSHIP_STATUS.ACTIVE },
      { $set: { status: MEMBERSHIP_STATUS.EXPIRED } },
    );

    await MembershipModel.create({
      studentId: input.studentId,
      libraryId: input.libraryId,
      branchId: input.branchId,
      shiftId: input.shiftId ?? null,
      seatId: input.seatId ?? null,
      membershipType: input.membershipType ?? 'FULL_DAY',
      startDate,
      endDate,
      durationDays: input.durationDays,
      status: computeMembershipStatus(startDate, endDate),
      feePlanId: input.feePlanId ?? null,
      invoiceId: input.invoiceId,
      paymentId: input.paymentId,
    });

    await syncStudentMembershipDates(input.studentId, startDate, endDate);

    await InvoiceModel.updateOne(
      { _id: input.invoiceId },
      { $set: { membershipPeriodStart: startDate, membershipPeriodEnd: endDate } },
    );
  }

  async renew(
    user: AuthenticatedUser,
    studentId: string,
    input: {
      feePlanId: string;
      durationDays?: number;
      membershipType?: string;
      collectPayment?: boolean;
    },
  ) {
    this.assertCan(user, PERMISSIONS.MEMBERSHIP_RENEW);
    const student = await StudentModel.findById(studentId);
    if (!student) throw ApiError.notFound('Student not found');

    const plan = await FeePlanModel.findById(input.feePlanId);
    if (!plan) throw ApiError.notFound('Fee plan not found');
    if (String(plan.libraryId) !== String(student.libraryId)) {
      throw ApiError.badRequest('Fee plan does not belong to this library');
    }

    const durationDays = input.durationDays ?? plan.durationDays ?? 30;
    const now = new Date();
    const currentEnd = student.membershipEndDate ? new Date(student.membershipEndDate) : null;
    const expired = !currentEnd || currentEnd.getTime() < now.getTime();
    const startDate = expired ? now : new Date(student.membershipStartDate ?? now);
    const baseEnd = expired ? now : currentEnd!;
    const endDate = addDays(baseEnd, durationDays);

    const membership = await MembershipModel.create({
      studentId: student._id,
      libraryId: student.libraryId,
      branchId: student.branchId,
      shiftId: null,
      seatId: student.assignedSeatId,
      membershipType: input.membershipType ?? 'FULL_DAY',
      startDate,
      endDate,
      durationDays,
      status: computeMembershipStatus(startDate, endDate),
      feePlanId: plan._id,
      invoiceId: null,
      paymentId: null,
    });

    await syncStudentMembershipDates(student._id, startDate, endDate);
    return toJSON(membership.toObject());
  }

  async getDashboardStats(user: AuthenticatedUser, opts: { libraryId?: string; branchId?: string }) {
    this.assertCan(user, PERMISSIONS.MEMBERSHIP_READ);
    const filter: Record<string, unknown> = {};
    if (user.role === ROLES.SUPER_ADMIN) {
      if (opts.libraryId) filter.libraryId = new Types.ObjectId(opts.libraryId);
      if (opts.branchId) filter.branchId = new Types.ObjectId(opts.branchId);
    } else {
      if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
      filter.libraryId = new Types.ObjectId(user.libraryId);
      if (user.branchId) filter.branchId = new Types.ObjectId(user.branchId);
      else if (opts.branchId) filter.branchId = new Types.ObjectId(opts.branchId);
    }

    const bounds = getMembershipDateBounds();
    const counts = buildDashboardCountFilters(filter, bounds);

    const [expiredSuspended, expiring1to3, expiring4to7, active] = await Promise.all([
      StudentModel.countDocuments(counts.expiredSuspended),
      StudentModel.countDocuments(counts.expiring1to3),
      StudentModel.countDocuments(counts.expiring4to7),
      StudentModel.countDocuments(counts.active),
    ]);

    return {
      active,
      expired: expiredSuspended,
      expiring1to3,
      expiring4to7,
      expiredToday: 0,
    };
  }

  async listForStudent(user: AuthenticatedUser, studentId: string) {
    this.assertCan(user, PERMISSIONS.MEMBERSHIP_READ);
    const items = await MembershipModel.find({ studentId: new Types.ObjectId(studentId) })
      .sort({ createdAt: -1 })
      .lean();
    const invoiceIds = items.map((i) => i.invoiceId).filter(Boolean);
    const feePlanIds = items.map((i) => i.feePlanId).filter(Boolean);
    const [invoices, feePlans] = await Promise.all([
      invoiceIds.length
        ? InvoiceModel.find({ _id: { $in: invoiceIds } })
            .select('_id dueAmount dueDate status invoiceNumber')
            .lean()
        : Promise.resolve([]),
      feePlanIds.length
        ? FeePlanModel.find({ _id: { $in: feePlanIds } })
            .select('_id allowPartialStart offerLabel')
            .lean()
        : Promise.resolve([]),
    ]);
    const invMap = new Map(invoices.map((inv) => [String(inv._id), inv]));
    const planMap = new Map(
      (feePlans as IFeePlanDocument[]).map((p) => [String(p._id), p]),
    );
    return items.map((i) => {
      const base = toJSON(i) as Record<string, unknown>;
      if (i.feePlanId) {
        const plan = planMap.get(String(i.feePlanId));
        if (plan) {
          base.allowPartialStart = plan.allowPartialStart ?? false;
          base.feePlanOfferLabel = plan.offerLabel ?? null;
        }
      }
      if (i.invoiceId) {
        const inv = invMap.get(String(i.invoiceId));
        if (inv) {
          base.linkedInvoice = {
            invoiceId: String(inv._id),
            invoiceNumber: inv.invoiceNumber,
            dueAmount: inv.dueAmount,
            dueDate: inv.dueDate,
            status: inv.status,
          };
        }
      }
      return base;
    });
  }
}

export const membershipService = new MembershipService();
