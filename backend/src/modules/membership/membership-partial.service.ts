import { Types } from 'mongoose';

import { InvoiceModel } from '@modules/payments/invoice.model';
import { roundMoney } from '@modules/payments/payment.service';
import { logActivity } from '@modules/activity/activity-audit.service';

import { MembershipModel } from './membership.model';
import { DOWNGRADE_STATUS, type DowngradeStatus } from './membership.constants';
import { addDays, syncStudentMembershipDates } from './membership.service';
import {
  getMinimumStartAmount,
  computePartialDueDate,
  type PartialPlanFeePlanLike,
  type ResolvedPartialPlanConfig,
} from './partial-plan.util';

const EPS = 0.009;

export interface PartialPlanSetupInput {
  membershipId: Types.ObjectId | string;
  feePlan: PartialPlanFeePlanLike;
  config: ResolvedPartialPlanConfig;
  invoiceAmount: number;
  paidAmount: number;
  startDate: Date;
  selectedDurationDays: number;
  invoiceId: Types.ObjectId | string;
  downgradeDueDate: Date;
}

export async function applyPartialPlanOnMembership(input: PartialPlanSetupInput): Promise<void> {
  const originalEndDate = addDays(input.startDate, input.selectedDurationDays);
  const minimumStart = getMinimumStartAmount(input.feePlan, input.invoiceAmount, input.config);
  const paid = roundMoney(input.paidAmount);
  const total = roundMoney(input.invoiceAmount);
  const isPartial = input.config.allowPartialStart && paid > EPS && paid < total - EPS;
  const isFullPaid = paid >= total - EPS;

  let downgradeStatus: DowngradeStatus = DOWNGRADE_STATUS.NONE;
  if (input.config.allowPartialStart) {
    if (isFullPaid || !input.config.downgradeIfUnpaid) {
      downgradeStatus = DOWNGRADE_STATUS.NOT_REQUIRED;
    } else if (isPartial || paid <= EPS) {
      downgradeStatus = DOWNGRADE_STATUS.PENDING;
    } else {
      downgradeStatus = DOWNGRADE_STATUS.NOT_REQUIRED;
    }
  }

  await MembershipModel.updateOne(
    { _id: input.membershipId },
    {
      $set: {
        selectedPlanDurationDays: input.selectedDurationDays,
        effectiveDurationDays: input.selectedDurationDays,
        originalEndDate,
        effectiveEndDate: originalEndDate,
        downgradeDueDate: isPartial || (paid <= EPS && input.config.allowPartialStart)
          ? input.downgradeDueDate
          : null,
        downgradeStatus,
        downgradeReason: null,
        fullPaymentRequiredAmount: total,
        paidBeforeDowngrade: paid,
        pendingUpgradeAmount: roundMoney(Math.max(0, total - paid)),
      },
    },
  );

  await InvoiceModel.updateOne(
    { _id: input.invoiceId },
    {
      $set: {
        membershipId: new Types.ObjectId(String(input.membershipId)),
        downgradeDueDate: input.downgradeDueDate,
        downgradeIfUnpaid: input.config.downgradeIfUnpaid,
        selectedDurationDays: input.selectedDurationDays,
        downgradeDurationDays: input.config.downgradeDurationDays,
        partialMinimumAmount: minimumStart,
      },
    },
  );
}

export async function resolveDowngradeOnInvoicePayment(invoiceId: Types.ObjectId | string): Promise<void> {
  const inv = await InvoiceModel.findById(invoiceId).lean();
  if (!inv || !inv.membershipId) return;

  const membership = await MembershipModel.findById(inv.membershipId);
  if (!membership) return;
  if (membership.downgradeStatus !== DOWNGRADE_STATUS.PENDING) return;

  const due = roundMoney(inv.dueAmount ?? 0);
  if (due > EPS) return;

  const now = new Date();
  const downgradeDue = membership.downgradeDueDate ? new Date(membership.downgradeDueDate) : null;
  if (downgradeDue && now.getTime() > downgradeDue.getTime()) return;

  const originalEnd = membership.originalEndDate
    ? new Date(membership.originalEndDate)
    : membership.endDate;

  membership.downgradeStatus = DOWNGRADE_STATUS.NOT_REQUIRED;
  membership.effectiveEndDate = originalEnd;
  membership.endDate = originalEnd;
  membership.effectiveDurationDays = membership.selectedPlanDurationDays ?? membership.durationDays;
  membership.pendingUpgradeAmount = 0;
  membership.downgradeDueDate = null;
  await membership.save();

  await syncStudentMembershipDates(membership.studentId, membership.startDate, originalEnd);

  await InvoiceModel.updateOne(
    { _id: inv._id },
    { $set: { membershipPeriodEnd: originalEnd } },
  );
}

export async function processPendingMembershipDowngrades(now = new Date()): Promise<number> {
  const pending = await MembershipModel.find({
    downgradeStatus: DOWNGRADE_STATUS.PENDING,
    downgradeDueDate: { $lt: now },
  }).lean();

  let processed = 0;
  for (const row of pending) {
    if (!row.invoiceId) continue;
    const inv = await InvoiceModel.findById(row.invoiceId).lean();
    if (!inv || roundMoney(inv.dueAmount ?? 0) <= EPS) {
      await MembershipModel.updateOne(
        { _id: row._id },
        { $set: { downgradeStatus: DOWNGRADE_STATUS.NOT_REQUIRED } },
      );
      continue;
    }

    const membership = await MembershipModel.findById(row._id);
    if (!membership || membership.downgradeStatus !== DOWNGRADE_STATUS.PENDING) continue;

    const downgradeDays =
      inv.downgradeDurationDays ??
      (membership.selectedPlanDurationDays && membership.selectedPlanDurationDays > 30 ? 30 : 30);
    const effectiveEnd = addDays(new Date(membership.startDate), downgradeDays);

    membership.effectiveDurationDays = downgradeDays;
    membership.effectiveEndDate = effectiveEnd;
    membership.endDate = effectiveEnd;
    membership.durationDays = downgradeDays;
    membership.downgradeStatus = DOWNGRADE_STATUS.COMPLETED;
    membership.downgradeReason = 'Remaining amount not paid by due date';
    membership.pendingUpgradeAmount = roundMoney(inv.dueAmount ?? 0);
    await membership.save();

    await syncStudentMembershipDates(membership.studentId, membership.startDate, effectiveEnd);

    const note = `[Auto-downgrade] Membership reduced to ${downgradeDays} days — remaining payment not received by due date.`;
    await InvoiceModel.updateOne(
      { _id: inv._id },
      {
        $set: { membershipPeriodEnd: effectiveEnd },
        $push: { adjustmentNotes: note },
      },
    );

    logActivity({
      actorUserId: null,
      action: 'MEMBERSHIP_DOWNGRADED',
      entityType: 'MEMBERSHIP',
      entityId: String(membership._id),
      libraryId: String(membership.libraryId),
      branchId: String(membership.branchId),
      metadata: {
        description: note,
        invoiceId: String(inv._id),
        studentId: String(membership.studentId),
      },
    });

    processed += 1;
  }
  return processed;
}
