import cron from 'node-cron';
import mongoose from 'mongoose';

import { ENV } from '@config/env.config';
import { logger } from '@utils/logger';
import { LibraryModel } from '@modules/library/library.models';
import { LIBRARY_STATUS, SUBSCRIPTION_STATUS } from '@modules/library/library.constants';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { StudentModel } from '@modules/students/students.models';
import { STUDENT_STATUS } from '@modules/students/student.constants';

import { notificationsService } from './notifications.service';
import { subscriptionBillingService } from '@modules/subscription-billing/subscription-billing.service';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function runPaymentDueReminders(): Promise<void> {
  const today = new Date();
  const dueOn = new Date(today);
  dueOn.setDate(dueOn.getDate() + 3);
  const from = startOfDay(dueOn);
  const to = endOfDay(dueOn);

  const invoices = await InvoiceModel.find({
    dueDate: { $gte: from, $lte: to },
    dueAmount: { $gt: 0.01 },
    status: { $in: ['UNPAID', 'PARTIAL'] },
  })
    .select('libraryId branchId studentId dueDate dueAmount invoiceNumber')
    .lean();

  for (const inv of invoices) {
    const st = await StudentModel.findById(inv.studentId).select('userId fullName').lean();
    if (!st?.userId) continue;
    await notificationsService.dispatchCronReminder({
      libraryId: inv.libraryId as mongoose.Types.ObjectId,
      branchId: inv.branchId as mongoose.Types.ObjectId,
      type: 'PAYMENT_DUE',
      title: 'Payment due soon',
      message: `Invoice ${inv.invoiceNumber} is due on ${new Date(inv.dueDate).toDateString()}. Outstanding: ${inv.dueAmount}.`,
      recipientUserIds: [st.userId as mongoose.Types.ObjectId],
    });
  }
}

async function runOverdueReminders(): Promise<void> {
  const now = new Date();
  const invoices = await InvoiceModel.find({
    $or: [{ status: 'OVERDUE' }, { status: { $in: ['UNPAID', 'PARTIAL'] }, dueDate: { $lt: now } }],
    dueAmount: { $gt: 0.01 },
  })
    .select('libraryId branchId studentId dueDate dueAmount invoiceNumber status')
    .lean();

  for (const inv of invoices) {
    const st = await StudentModel.findById(inv.studentId).select('userId').lean();
    if (!st?.userId) continue;
    await notificationsService.dispatchCronReminder({
      libraryId: inv.libraryId as mongoose.Types.ObjectId,
      branchId: inv.branchId as mongoose.Types.ObjectId,
      type: 'PAYMENT_OVERDUE',
      title: 'Overdue payment',
      message: `Invoice ${inv.invoiceNumber} is overdue. Please clear dues of ${inv.dueAmount}.`,
      recipientUserIds: [st.userId as mongoose.Types.ObjectId],
    });
  }
}

async function runMembershipExpiryReminders(): Promise<void> {
  const today = new Date();
  const exp = new Date(today);
  exp.setDate(exp.getDate() + 7);
  const from = startOfDay(exp);
  const to = endOfDay(exp);

  const students = await StudentModel.find({
    status: STUDENT_STATUS.ACTIVE,
    membershipEndDate: { $gte: from, $lte: to },
    userId: { $ne: null },
  })
    .select('libraryId branchId fullName membershipEndDate userId')
    .lean();

  for (const st of students) {
    if (!st.userId) continue;
    await notificationsService.dispatchCronReminder({
      libraryId: st.libraryId as mongoose.Types.ObjectId,
      branchId: st.branchId as mongoose.Types.ObjectId,
      type: 'MEMBERSHIP_EXPIRY',
      title: 'Membership expiring',
      message: `${st.fullName}, your membership ends on ${st.membershipEndDate ? new Date(st.membershipEndDate).toDateString() : 'soon'}.`,
      recipientUserIds: [st.userId as mongoose.Types.ObjectId],
    });
  }
}

async function runTrialEndingReminders(): Promise<void> {
  const today = new Date();
  const warnDate = new Date(today);
  warnDate.setDate(warnDate.getDate() + 3);
  const from = startOfDay(warnDate);
  const to = endOfDay(warnDate);

  const libs = await LibraryModel.find({
    status: LIBRARY_STATUS.TRIAL,
    trialEndsAt: { $gte: from, $lte: to },
    ownerId: { $ne: null },
  })
    .select('_id ownerId name trialEndsAt settings')
    .lean();

  for (const lib of libs) {
    const flag = `trialExpireWarn3d_${from.toISOString().slice(0, 10)}`;
    const settings = (lib.settings ?? {}) as Record<string, unknown>;
    if (settings[flag]) continue;
    await notificationsService.dispatchCronReminder({
      libraryId: lib._id as mongoose.Types.ObjectId,
      branchId: null,
      type: 'SYSTEM',
      title: 'Trial ending soon',
      message: `${lib.name}: trial ends in about 3 days (${lib.trialEndsAt ? new Date(lib.trialEndsAt).toDateString() : 'soon'}).`,
      recipientUserIds: [lib.ownerId as mongoose.Types.ObjectId],
    });
    await LibraryModel.updateOne({ _id: lib._id }, { $set: { [`settings.${flag}`]: true } });
  }
}

async function runAutoSuspendTrialsPastGrace(): Promise<void> {
  const now = Date.now();
  const graceMs = 2 * 24 * 60 * 60 * 1000;

  const trials = await LibraryModel.find({
    status: LIBRARY_STATUS.TRIAL,
    trialEndsAt: { $ne: null },
  })
    .select('_id trialEndsAt')
    .lean();

  for (const lib of trials) {
    const endMs = lib.trialEndsAt ? new Date(lib.trialEndsAt).getTime() : NaN;
    if (Number.isNaN(endMs) || now < endMs + graceMs) continue;

    await LibraryModel.updateOne(
      { _id: lib._id, status: LIBRARY_STATUS.TRIAL },
      {
        $set: {
          status: LIBRARY_STATUS.SUSPENDED,
          suspendedAt: new Date(),
          suspensionReason: 'Trial ended — renewal or upgrade required.',
          subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
        },
      },
    );

    logger.info('[notifications:cron] Auto-suspended library after trial grace', {
      libraryId: String(lib._id),
    });
  }
}

async function runAllReminderJobs(): Promise<void> {
  try {
    await runAutoSuspendTrialsPastGrace();

    const { librarySubscriptionService } = await import(
      '@modules/subscription-billing/library-subscription.service'
    );
    const promoted = await librarySubscriptionService.promoteAllScheduledIfDue();
    if (promoted > 0) {
      logger.info('[notifications:cron] Promoted scheduled subscriptions', { promoted });
    }

    await subscriptionBillingService.markOverdueInvoices();
    await subscriptionBillingService.remindSubscriptionInvoicesDueSoon();
    await subscriptionBillingService.suspendLibrariesPastSubscriptionGrace();

    const tenantLibs = await LibraryModel.countDocuments({
      status: { $in: [LIBRARY_STATUS.ACTIVE, LIBRARY_STATUS.TRIAL] },
    });
    if (tenantLibs === 0) {
      logger.info('[notifications:cron] No tenant libraries; skipping reminder sweep.');
      return;
    }
    await runPaymentDueReminders();
    await runOverdueReminders();
    await runMembershipExpiryReminders();
    const { processExpiredMembershipStudents } = await import(
      '@modules/membership/membership.service'
    );
    const expiredSeatsReleased = await processExpiredMembershipStudents();
    if (expiredSeatsReleased > 0) {
      logger.info('[notifications:cron] Released seats for expired memberships', {
        count: expiredSeatsReleased,
      });
    }
    await runTrialEndingReminders();
    logger.info('[notifications:cron] Reminder sweep completed.');
  } catch (err) {
    logger.error('[notifications:cron] Reminder sweep failed:', err);
  }
}

/**
 * Schedules daily reminder jobs. Safe no-op when {@link ENV.NOTIFICATION_JOBS_ENABLED} is false.
 */
export function registerNotificationCronJobs(): void {
  if (!ENV.NOTIFICATION_JOBS_ENABLED) {
    logger.info('[notifications] Cron jobs disabled (set NOTIFICATION_JOBS_ENABLED=true to enable).');
    return;
  }

  // 09:10 server local time — single sweep to avoid duplicate noisy sends if overlapping windows.
  cron.schedule('10 9 * * *', () => {
    void runAllReminderJobs();
  });

  logger.info('[notifications] Cron jobs registered (daily 09:10, NOTIFICATION_JOBS_ENABLED=true).');
}
