import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { FeePlanModel } from '@modules/payments/payments.models';
import { paymentService } from '@modules/payments/payment.service';
import { membershipService, addDays } from '@modules/membership/membership.service';
import { MEMBERSHIP_TYPE, type MembershipType } from '@modules/membership/membership.constants';
import { MembershipModel } from '@modules/membership/membership.model';
import { ShiftModel } from '@modules/shifts/shift.model';
import { SeatModel } from '@modules/seats/seat.model';
import { createSeatAssignment } from '@modules/seats/seat-assignment.service';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

import { StudentModel } from './students.models';
import type { StudentAdmissionInput } from './student-admission.validation';
import { applyStudentUploads, type StudentUploadFiles } from './student.service';
import { UserModel, RoleModel } from '@modules/auth/auth.models';
import { STUDENT_STATUS } from './student.constants';
import { logActivity } from '@modules/activity/activity-audit.service';
import { PLAN_LIMIT_ENTITY } from '@modules/subscription-billing/subscription-limit.constants';
import { subscriptionLimitService } from '@modules/subscription-billing/subscription-limit.service';
import {
  applyPartialPlanOnMembership,
} from '@modules/membership/membership-partial.service';
import {
  getMinimumStartAmount,
  computePartialDueDate,
  parseLibraryMembershipSettings,
  resolvePartialPlanConfig,
  validatePartialPaymentAmount,
} from '@modules/membership/partial-plan.util';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

type CompensationFn = () => Promise<void>;

class CompensationStack {
  private readonly fns: CompensationFn[] = [];

  push(fn: CompensationFn): void {
    this.fns.push(fn);
  }

  async rollback(): Promise<void> {
    for (const fn of [...this.fns].reverse()) {
      try {
        await fn();
      } catch {
        /* best effort */
      }
    }
  }
}

function mapShiftToMembershipType(shiftType: string): MembershipType {
  const map: Record<string, MembershipType> = {
    MORNING: MEMBERSHIP_TYPE.MORNING,
    AFTERNOON: MEMBERSHIP_TYPE.AFTERNOON,
    EVENING: MEMBERSHIP_TYPE.EVENING,
    NIGHT: MEMBERSHIP_TYPE.NIGHT,
    FULL_DAY: MEMBERSHIP_TYPE.FULL_DAY,
    CUSTOM: MEMBERSHIP_TYPE.CUSTOM_SHIFT,
  };
  return map[shiftType] ?? MEMBERSHIP_TYPE.CUSTOM_SHIFT;
}

async function allocateStudentId(libraryId: Types.ObjectId): Promise<string> {
  const crypto = await import('node:crypto');
  for (let i = 0; i < 16; i += 1) {
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    const candidate = `STU-${suffix}`;
    const exists = await StudentModel.exists({ libraryId, studentId: candidate });
    if (!exists) return candidate;
  }
  throw ApiError.internal('Unable to generate a unique studentId');
}

class StudentAdmissionService {
  async admitStudent(
    user: AuthenticatedUser,
    input: StudentAdmissionInput,
    files?: StudentUploadFiles,
  ) {
    if (!user.permissions.includes(PERMISSIONS.STUDENT_CREATE)) {
      throw ApiError.forbidden('Insufficient permissions to admit students');
    }

    const branch = await BranchModel.findById(input.branchId).lean();
    if (!branch) throw ApiError.badRequest('Branch not found');
    const libraryId = branch.libraryId as Types.ObjectId;
    const branchId = branch._id as Types.ObjectId;

    if (user.role !== ROLES.SUPER_ADMIN) {
      if (!user.libraryId || user.libraryId !== String(libraryId)) {
        throw ApiError.forbidden('Branch is not part of your library');
      }
      if (user.branchId && user.branchId !== String(branchId)) {
        throw ApiError.forbidden('You can only admit students to your branch');
      }
    }

    const membershipEnabled = Boolean(input.membership?.enabled);
    const seatEnabled = Boolean(input.seatAssignment?.enabled);
    const paymentEnabled = Boolean(input.payment?.enabled);

    if (membershipEnabled && !user.permissions.includes(PERMISSIONS.MEMBERSHIP_CREATE)) {
      throw ApiError.forbidden('Insufficient permissions to create membership');
    }
    if (seatEnabled && !user.permissions.includes(PERMISSIONS.SEAT_ASSIGN)) {
      throw ApiError.forbidden('Insufficient permissions to assign seats');
    }
    if (
      (membershipEnabled || paymentEnabled) &&
      !user.permissions.includes(PERMISSIONS.PAYMENT_CREATE)
    ) {
      throw ApiError.forbidden('Insufficient permissions to create invoices');
    }

    await subscriptionLimitService.validateLimitBeforeCreate(
      PLAN_LIMIT_ENTITY.STUDENTS,
      String(libraryId),
      { actorUserId: user.id },
    );

    const stack = new CompensationStack();
    let studentDocId: Types.ObjectId | null = null;
    let membershipId: Types.ObjectId | null = null;

    try {
      const now = new Date();
      const admissionDate = input.admissionDate ?? now;
      const studentCode = input.studentId?.trim() || (await allocateStudentId(libraryId));

      if (await StudentModel.exists({ libraryId, studentId: studentCode })) {
        throw ApiError.conflict('studentId already exists in this library');
      }

      let membershipStart = admissionDate;
      let membershipEnd: Date | undefined;
      let shiftIdForMembership: Types.ObjectId | null = null;
      let feePlanDoc: Record<string, unknown> | null = null;
      let invoiceAmount = 0;
      let partialConfig: ReturnType<typeof resolvePartialPlanConfig> | null = null;
      let minimumStartAmount = 0;
      let partialDueDate: Date | null = null;

      if (membershipEnabled && input.membership) {
        const [shift, plan] = await Promise.all([
          ShiftModel.findOne({
            _id: new Types.ObjectId(input.membership.shiftId),
            branchId,
            libraryId,
            active: true,
          }).lean(),
          FeePlanModel.findOne({
            _id: new Types.ObjectId(input.membership.feePlanId),
            branchId,
            libraryId,
            active: true,
          }).lean(),
        ]);
        if (!shift) throw ApiError.badRequest('Shift not found or inactive');
        if (!plan) throw ApiError.badRequest('Fee plan not found or inactive');

        feePlanDoc = plan as unknown as Record<string, unknown>;
        shiftIdForMembership = shift._id as Types.ObjectId;
        membershipStart = input.membership.startDate;

        if (input.membership.endDate) {
          if (!user.permissions.includes(PERMISSIONS.MEMBERSHIP_UPDATE)) {
            throw ApiError.forbidden('Manual membership end date requires membership.update');
          }
          membershipEnd = input.membership.endDate;
        } else {
          membershipEnd = addDays(membershipStart, plan.durationDays);
        }

        if (plan.allowManualPriceOverride && input.membership.amountOverride !== undefined) {
          if (!user.permissions.includes(PERMISSIONS.PAYMENT_UPDATE)) {
            throw ApiError.forbidden('Fee amount override requires payment.update');
          }
          invoiceAmount = input.membership.amountOverride;
        } else {
          invoiceAmount = plan.amount;
        }

        const library = await LibraryModel.findById(libraryId).select('settings').lean();
        const libraryMembershipSettings = parseLibraryMembershipSettings(
          (library?.settings as Record<string, unknown>) ?? {},
        );
        partialConfig = resolvePartialPlanConfig(plan, libraryMembershipSettings);
        minimumStartAmount = getMinimumStartAmount(plan, invoiceAmount, partialConfig);
        partialDueDate = computePartialDueDate(now, partialConfig.partialDueDays);

        if (paymentEnabled && input.payment) {
          const paid = input.payment.paidAmount ?? 0;
          const paymentErr = validatePartialPaymentAmount({
            allowPartialStart: partialConfig.allowPartialStart,
            minimumStartAmount,
            paidAmount: paid,
            invoiceTotal: invoiceAmount,
          });
          if (paymentErr) {
            throw ApiError.unprocessable(paymentErr, {
              minimumRequired: minimumStartAmount,
              paidAmount: paid,
            });
          }
        }
      }

      const student = await StudentModel.create({
        libraryId,
        branchId,
        studentId: studentCode,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        gender: input.gender,
        dateOfBirth: input.dateOfBirth ?? undefined,
        address: input.address,
        city: input.city,
        state: input.state,
        pincode: input.pincode,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        guardianName: input.guardianName,
        guardianPhone: input.guardianPhone,
        aadhaarNumber: input.aadhaarNumber,
        admissionDate,
        membershipStartDate: membershipEnabled ? membershipStart : undefined,
        membershipEndDate: membershipEnabled ? membershipEnd : undefined,
        status: input.status ?? STUDENT_STATUS.ACTIVE,
        notes: input.notes,
        assignedSeatId: null,
        currentShiftId: shiftIdForMembership,
        userId: null,
      });

      studentDocId = student._id as Types.ObjectId;
      stack.push(async () => {
        await StudentModel.deleteOne({ _id: studentDocId });
      });

      if (input.createLoginAccount) {
        const existingUser = await UserModel.findOne({
          email: input.email.trim().toLowerCase(),
        }).lean();
        if (existingUser) throw ApiError.conflict('A user account already exists with this email');

        const studentRole = await RoleModel.findOne({
          name: ROLES.STUDENT,
          isSystem: true,
          libraryId: null,
        }).lean();
        if (!studentRole) throw ApiError.internal('System role STUDENT not found');

        const passwordHash = await UserModel.hashPassword(input.temporaryPassword!);
        const userDoc = await UserModel.create({
          fullName: input.fullName.trim(),
          email: input.email.trim().toLowerCase(),
          phone: input.phone?.trim(),
          passwordHash,
          role: studentRole._id,
          libraryId,
          branchId,
          isActive: true,
          isEmailVerified: false,
          refreshTokens: [],
        });
        student.userId = userDoc._id as Types.ObjectId;
        await student.save();
        stack.push(async () => {
          await UserModel.deleteOne({ _id: userDoc._id });
        });
      }

      if (files?.profilePhoto || files?.documentProof) {
        await applyStudentUploads(student, files);
      }

      let membership: Record<string, unknown> | null = null;
      if (membershipEnabled && input.membership && feePlanDoc && membershipEnd) {
        const shift = await ShiftModel.findById(shiftIdForMembership).lean();
        const membershipType =
          input.membership.membershipType &&
          (Object.values(MEMBERSHIP_TYPE) as string[]).includes(input.membership.membershipType)
            ? (input.membership.membershipType as MembershipType)
            : mapShiftToMembershipType(String(shift?.type ?? 'CUSTOM'));

        membership = (await membershipService.createMembership(user, {
          studentId: String(studentDocId),
          libraryId: String(libraryId),
          branchId: String(branchId),
          shiftId: String(shiftIdForMembership),
          seatId: seatEnabled && input.seatAssignment?.seatId ? input.seatAssignment.seatId : null,
          membershipType,
          startDate: membershipStart,
          durationDays: Math.max(
            1,
            Math.ceil(
              (membershipEnd.getTime() - membershipStart.getTime()) / (24 * 60 * 60 * 1000),
            ),
          ),
          feePlanId: String(feePlanDoc._id as Types.ObjectId),
        })) as Record<string, unknown>;
        membershipId = new Types.ObjectId(String((membership as { _id: string })._id));
        stack.push(async () => {
          await MembershipModel.deleteOne({ _id: membershipId });
        });
      }

      let seatAssignment: Record<string, unknown> | null = null;
      if (seatEnabled && input.seatAssignment) {
        const seat = await SeatModel.findById(input.seatAssignment.seatId);
        if (!seat) throw ApiError.notFound('Seat not found');
        if (String(seat.branchId) !== String(branchId)) {
          throw ApiError.badRequest('Seat must belong to the admission branch');
        }

        const assignShiftId = new Types.ObjectId(input.seatAssignment.shiftId);
        seatAssignment = (await createSeatAssignment({
          user,
          seat,
          studentId: studentDocId,
          shiftId: assignShiftId,
          startDate: membershipStart,
          endDate: membershipEnd ?? null,
          membershipId,
        })) as Record<string, unknown>;
        const assignmentId = new Types.ObjectId(String((seatAssignment as { _id: string })._id));
        stack.push(async () => {
          await SeatAssignmentModel.updateOne(
            { _id: assignmentId },
            { $set: { status: SHIFT_ASSIGNMENT_STATUS.CANCELLED } },
          );
        });

        student.assignedSeatId = seat._id as Types.ObjectId;
        student.currentShiftId = assignShiftId;
        await student.save();
      }

      let invoice: Record<string, unknown> | null = null;
      if (membershipEnabled && feePlanDoc && membershipEnd) {
        const dueDate =
          input.payment?.dueDate ??
          (partialConfig?.allowPartialStart && partialDueDate
            ? partialDueDate
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
        invoice = (await paymentService.createInvoice(user, {
          branchId: String(branchId),
          studentId: String(studentDocId),
          seatId: seatEnabled ? input.seatAssignment?.seatId : undefined,
          feePlanId: String(feePlanDoc._id as Types.ObjectId),
          amount: invoiceAmount,
          discountAmount: input.payment?.discountAmount ?? 0,
          taxAmount: input.payment?.taxAmount ?? 0,
          dueDate,
          notes: input.payment?.notes,
          status: 'UNPAID',
          membershipPeriodStart: membershipStart,
          membershipPeriodEnd: membershipEnd,
        })) as Record<string, unknown>;
        const invoiceId = new Types.ObjectId(String((invoice as { _id: string })._id));
        if (membershipId) {
          await MembershipModel.updateOne({ _id: membershipId }, { $set: { invoiceId } });
          if (partialConfig) {
            const paidNow = paymentEnabled ? (input.payment?.paidAmount ?? 0) : 0;
            await applyPartialPlanOnMembership({
              membershipId,
              feePlan: feePlanDoc as never,
              config: partialConfig,
              invoiceAmount,
              paidAmount: paidNow,
              startDate: membershipStart,
              selectedDurationDays: Number(feePlanDoc.durationDays),
              invoiceId,
              downgradeDueDate: dueDate,
            });
          }
        }
        stack.push(async () => {
          await paymentService.updateInvoice(user, String(invoiceId), { status: 'CANCELLED' });
        });
      }

      let payment: Record<string, unknown> | null = null;
      let receipt: Record<string, unknown> | null = null;
      if (paymentEnabled && input.payment && invoice) {
        const paid = input.payment.paidAmount ?? 0;
        if (paid > 0) {
          const collected = await paymentService.collectPayment(user, {
            invoiceId: String((invoice as { _id: string })._id),
            amount: paid,
            method: input.payment.method!,
            transactionId: input.payment.transactionId,
            notes: input.payment.notes,
            skipMembershipExtension: membershipEnabled,
            allowOverpayment: false,
          });
          payment = collected.payment as Record<string, unknown>;
          invoice = collected.invoice as Record<string, unknown>;
          receipt = payment;
          if (membershipId && payment?._id) {
            await MembershipModel.updateOne(
              { _id: membershipId },
              {
                $set: {
                  paymentId: new Types.ObjectId(String(payment._id)),
                  paidBeforeDowngrade: paid,
                },
              },
            );
            if (partialConfig && feePlanDoc) {
              await applyPartialPlanOnMembership({
                membershipId,
                feePlan: feePlanDoc as never,
                config: partialConfig,
                invoiceAmount,
                paidAmount: paid,
                startDate: membershipStart,
                selectedDurationDays: Number(feePlanDoc.durationDays),
                invoiceId: new Types.ObjectId(String((invoice as { _id: string })._id)),
                downgradeDueDate:
                  input.payment?.dueDate ??
                  (partialDueDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
              });
            }
          }
        }
      }

      const createdStudent = await StudentModel.findById(studentDocId).lean();

      logActivity({
        actorUserId: user.id,
        action: 'STUDENT_ADMITTED',
        entityType: 'STUDENT',
        entityId: String(studentDocId),
        libraryId: String(libraryId),
        branchId: String(branchId),
        metadata: {
          studentName: input.fullName,
          entityLabel: input.fullName,
          description: `Student ${studentCode} admitted with workflow`,
        },
      });

      return {
        student: toJSON(createdStudent),
        membership,
        seatAssignment,
        invoice,
        payment,
        receipt,
      };
    } catch (err) {
      await stack.rollback();
      throw err;
    }
  }
}

export const studentAdmissionService = new StudentAdmissionService();
