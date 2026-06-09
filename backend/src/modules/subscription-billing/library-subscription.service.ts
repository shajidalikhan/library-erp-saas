import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { LibraryModel } from '@modules/library/library.models';
import {
  LIBRARY_STATUS,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { normalizePlanKey, planKeyRegex } from '@modules/platform/platform-catalog-plan.util';
import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';
import {
  normalizeLegacyPlanCode,
  planDisplayName,
} from './subscription-lifecycle.util';

import { LibrarySubscriptionModel } from './library-subscription.model';
import { SubscriptionEventModel } from './subscription-event.model';
import { PlatformSubscriptionInvoiceModel } from './platform-subscription-invoice.model';
import {
  SUBSCRIPTION_AUDIT_ACTION,
  SUBSCRIPTION_EVENT_TYPE,
  SUBSCRIPTION_RECORD_BILLING_CYCLE,
  SUBSCRIPTION_RECORD_STATUS,
} from './library-subscription.constants';
import { PLATFORM_SUBSCRIPTION_INVOICE_STATUS } from './subscription-billing.constants';
import { startOfDay, endOfDay, roundMoney, dateOnlyUtc } from './subscription-billing.helpers';
import type { AdjustLibrarySubscriptionBody, ExtendTrialBody } from './library-subscription.validation';
import type { ILibrarySubscriptionDocument } from './library-subscription.model';

function assertSuperAdmin(user: AuthenticatedUser): void {
  if (user.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Super admin access required');
}

function subscriptionToJson(doc: ILibrarySubscriptionDocument) {
  return {
    id: String(doc._id),
    libraryId: String(doc.libraryId),
    planId: doc.planId ? String(doc.planId) : null,
    planCode: doc.planCode,
    planName: doc.planName,
    billingCycle: doc.billingCycle,
    status: doc.status,
    startDate: doc.startDate,
    endDate: doc.endDate,
    trialEndsAt: doc.trialEndsAt,
    graceEndsAt: doc.graceEndsAt,
    currentInvoiceId: doc.currentInvoiceId ? String(doc.currentInvoiceId) : null,
    lastPaymentId: doc.lastPaymentId ? String(doc.lastPaymentId) : null,
    amount: doc.amount,
    paidAmount: doc.paidAmount,
    dueAmount: doc.dueAmount,
    autoRenew: doc.autoRenew,
    manuallyAdjusted: doc.manuallyAdjusted,
    adjustmentReason: doc.adjustmentReason,
    upcoming:
      doc.upcomingStartDate && doc.upcomingPlanCode
        ? {
            planId: doc.upcomingPlanId ? String(doc.upcomingPlanId) : null,
            planCode: doc.upcomingPlanCode,
            planName: doc.upcomingPlanName,
            billingCycle: doc.upcomingBillingCycle,
            startDate: doc.upcomingStartDate,
            endDate: doc.upcomingEndDate,
          }
        : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class LibrarySubscriptionService {
  async recordEvent(input: {
    libraryId: Types.ObjectId;
    type: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    actorUserId?: string | null;
  }): Promise<void> {
    await SubscriptionEventModel.create({
      libraryId: input.libraryId,
      type: input.type,
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
      actorUserId: input.actorUserId ? new Types.ObjectId(input.actorUserId) : null,
    });
  }

  async ensureFromLibrary(libraryId: Types.ObjectId): Promise<ILibrarySubscriptionDocument> {
    const existing = await LibrarySubscriptionModel.findOne({ libraryId }).exec();
    if (existing) return existing;

    const lib = await LibraryModel.findById(libraryId).lean();
    if (!lib) throw ApiError.notFound('Library not found');

    const plan = await PlatformSubscriptionPlanModel.findOne({
      planKey: lib.subscriptionPlan,
    }).lean();

    const isTrial = lib.status === LIBRARY_STATUS.TRIAL;
    const billingCycle = isTrial
      ? SUBSCRIPTION_RECORD_BILLING_CYCLE.TRIAL
      : (lib as { billingCycle?: string }).billingCycle ?? SUBSCRIPTION_RECORD_BILLING_CYCLE.MONTHLY;

    let status: string = SUBSCRIPTION_RECORD_STATUS.TRIALING;
    if (lib.status === LIBRARY_STATUS.SUSPENDED) status = SUBSCRIPTION_RECORD_STATUS.SUSPENDED;
    else if ((lib as { subscriptionStatus?: string }).subscriptionStatus === SUBSCRIPTION_STATUS.PAST_DUE) {
      status = SUBSCRIPTION_RECORD_STATUS.PAST_DUE;
    } else if ((lib as { subscriptionStatus?: string }).subscriptionStatus === SUBSCRIPTION_STATUS.CANCELLED) {
      status = SUBSCRIPTION_RECORD_STATUS.CANCELLED;
    } else if (!isTrial && lib.status === LIBRARY_STATUS.ACTIVE) {
      status = SUBSCRIPTION_RECORD_STATUS.ACTIVE;
    }

    const doc = await LibrarySubscriptionModel.create({
      libraryId,
      planId: plan?._id ?? null,
      planCode: lib.subscriptionPlan,
      planName: plan?.displayName ?? lib.subscriptionPlan,
      billingCycle,
      status,
      startDate: (lib as { subscriptionStartsAt?: Date }).subscriptionStartsAt ?? lib.createdAt,
      endDate: (lib as { subscriptionEndsAt?: Date | null }).subscriptionEndsAt ?? null,
      trialEndsAt: (lib as { trialEndsAt?: Date | null }).trialEndsAt ?? null,
      graceEndsAt: null,
      currentInvoiceId: null,
      lastPaymentId: null,
      amount: 0,
      paidAmount: 0,
      dueAmount: 0,
      autoRenew: true,
      manuallyAdjusted: false,
      adjustmentReason: null,
      updatedBy: null,
    });

    await this.recordEvent({
      libraryId,
      type: SUBSCRIPTION_EVENT_TYPE.TRIAL_STARTED,
      title: 'Subscription record initialized',
      description: `Status ${status}`,
    });

    return doc;
  }

  /** Align LibrarySubscription with the live catalog after a tenant plan change. */
  async syncLibraryPlanFromCatalog(
    libraryId: string | Types.ObjectId,
    planCode: string,
    actorUserId?: string | null,
  ): Promise<void> {
    const normalized = normalizeLegacyPlanCode(normalizePlanKey(planCode));
    const plan = await PlatformSubscriptionPlanModel.findOne({
      planKey: planKeyRegex(normalized),
      active: true,
    }).lean();

    const sub = await this.ensureFromLibrary(new Types.ObjectId(String(libraryId)));
    sub.planCode = normalized;
    sub.planId = plan?._id ?? null;
    sub.planName = plan?.displayName ?? planDisplayName(normalized);
    sub.updatedBy = actorUserId ? new Types.ObjectId(actorUserId) : sub.updatedBy;
    await sub.save();
    await this.syncDenormalizedLibrary(sub);
  }

  /** Sync denormalized Library fields from LibrarySubscription. */
  async syncDenormalizedLibrary(sub: ILibrarySubscriptionDocument): Promise<void> {
    const now = startOfDay(new Date());
    const paidStart = sub.upcomingStartDate ? startOfDay(sub.upcomingStartDate) : null;
    const hasScheduledPaid = Boolean(
      sub.upcomingPlanCode &&
        sub.upcomingStartDate &&
        startOfDay(sub.upcomingStartDate).getTime() > now.getTime(),
    );

    const lib = await LibraryModel.findById(sub.libraryId).select('status').lean();
    const wasSuspended = lib?.status === LIBRARY_STATUS.SUSPENDED;

    let libraryStatus: string = LIBRARY_STATUS.ACTIVE;
    let subscriptionStatus: string = SUBSCRIPTION_STATUS.ACTIVE;

    if (sub.status === SUBSCRIPTION_RECORD_STATUS.SUSPENDED) {
      libraryStatus = LIBRARY_STATUS.SUSPENDED;
      subscriptionStatus = SUBSCRIPTION_STATUS.PAST_DUE;
    } else if (sub.status === SUBSCRIPTION_RECORD_STATUS.CANCELLED) {
      libraryStatus = LIBRARY_STATUS.SUSPENDED;
      subscriptionStatus = SUBSCRIPTION_STATUS.CANCELLED;
    } else if (sub.status === SUBSCRIPTION_RECORD_STATUS.TRIALING) {
      libraryStatus = LIBRARY_STATUS.TRIAL;
      subscriptionStatus = SUBSCRIPTION_STATUS.TRIALING;
    } else if (sub.status === SUBSCRIPTION_RECORD_STATUS.PAST_DUE) {
      libraryStatus = wasSuspended ? LIBRARY_STATUS.SUSPENDED : LIBRARY_STATUS.ACTIVE;
      subscriptionStatus = SUBSCRIPTION_STATUS.PAST_DUE;
    } else if (sub.status === SUBSCRIPTION_RECORD_STATUS.EXPIRED) {
      libraryStatus = LIBRARY_STATUS.SUSPENDED;
      subscriptionStatus = SUBSCRIPTION_STATUS.PAST_DUE;
    }

    const updates: Record<string, unknown> = {
      subscriptionPlan: sub.planCode,
      subscriptionStatus,
      status: libraryStatus,
      subscriptionStartsAt: sub.startDate,
      subscriptionEndsAt: sub.endDate,
      trialEndsAt: sub.trialEndsAt,
      billingCycle: sub.billingCycle,
    };

    if (sub.status === SUBSCRIPTION_RECORD_STATUS.ACTIVE && !hasScheduledPaid) {
      updates.trialEndsAt = null;
      if (!sub.manuallyAdjusted) {
        updates.suspendedAt = null;
        updates.suspensionReason = null;
      }
    }

    await LibraryModel.updateOne({ _id: sub.libraryId }, { $set: updates });
  }

  async applyInvoiceToSubscription(
    libraryId: Types.ObjectId,
    invoice: {
      _id: Types.ObjectId;
      planId: Types.ObjectId;
      planCode: string;
      planName: string;
      billingCycle: string;
      amount: number;
      paidAmount: number;
      dueAmount: number;
      status: string;
      subscriptionStartDate: Date;
      subscriptionEndDate: Date;
    },
    actorUserId: string | null,
  ): Promise<void> {
    const sub = await this.ensureFromLibrary(libraryId);
    const lib = await LibraryModel.findById(libraryId).lean();
    if (!lib) return;

    sub.currentInvoiceId = invoice._id;
    sub.amount = roundMoney(invoice.amount);
    sub.paidAmount = roundMoney(invoice.paidAmount);
    sub.dueAmount = roundMoney(invoice.dueAmount);
    sub.updatedBy = actorUserId ? new Types.ObjectId(actorUserId) : null;

    const now = startOfDay(new Date());
    const paidStart = startOfDay(invoice.subscriptionStartDate);
    const isFullyPaid = invoice.status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID;
    const isPartial =
      invoice.status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL ||
      (invoice.paidAmount > 0 && invoice.dueAmount > 0);
    const isTrialLib = lib.status === LIBRARY_STATUS.TRIAL || sub.status === SUBSCRIPTION_RECORD_STATUS.TRIALING;
    const futurePaidStart = paidStart.getTime() > now.getTime();

    if (isFullyPaid && futurePaidStart) {
      sub.upcomingPlanId = invoice.planId;
      sub.upcomingPlanCode = invoice.planCode;
      sub.upcomingPlanName = invoice.planName;
      sub.upcomingBillingCycle = invoice.billingCycle;
      sub.upcomingStartDate = paidStart;
      sub.upcomingEndDate = endOfDay(invoice.subscriptionEndDate);
      if (isTrialLib) {
        sub.status = SUBSCRIPTION_RECORD_STATUS.TRIALING;
      }
      await this.recordEvent({
        libraryId,
        type: SUBSCRIPTION_EVENT_TYPE.SUBSCRIPTION_SCHEDULED,
        title: isTrialLib ? 'Paid plan scheduled after trial' : 'Plan change scheduled',
        description: `Starts ${paidStart.toISOString().slice(0, 10)}`,
        metadata: { invoiceId: String(invoice._id), planCode: invoice.planCode },
        actorUserId,
      });
      await appendPlatformAuditLog({
        actorUserId,
        action: 'SUBSCRIPTION_SCHEDULED',
        entityType: 'LIBRARY_SUBSCRIPTION',
        entityId: String(sub._id),
        libraryId: String(libraryId),
        metadata: {
          planCode: invoice.planCode,
          startDate: paidStart.toISOString(),
          module: 'subscription-billing',
        },
      });
    } else if (isFullyPaid) {
      sub.status = SUBSCRIPTION_RECORD_STATUS.ACTIVE;
      sub.planId = invoice.planId;
      sub.planCode = invoice.planCode;
      sub.planName = invoice.planName;
      sub.billingCycle = invoice.billingCycle;
      sub.startDate = paidStart;
      sub.endDate = endOfDay(invoice.subscriptionEndDate);
      sub.trialEndsAt = null;
      sub.upcomingPlanId = null;
      sub.upcomingPlanCode = null;
      sub.upcomingPlanName = null;
      sub.upcomingBillingCycle = null;
      sub.upcomingStartDate = null;
      sub.upcomingEndDate = null;
      sub.lastPaymentId = invoice._id;
      await this.recordEvent({
        libraryId,
        type: SUBSCRIPTION_EVENT_TYPE.SUBSCRIPTION_ACTIVATED,
        title: 'Subscription activated',
        metadata: { invoiceId: String(invoice._id) },
        actorUserId,
      });
    } else if (isPartial) {
      sub.status = SUBSCRIPTION_RECORD_STATUS.PAST_DUE;
      await this.recordEvent({
        libraryId,
        type: SUBSCRIPTION_EVENT_TYPE.PAYMENT_COLLECTED,
        title: 'Partial payment recorded',
        metadata: {
          invoiceId: String(invoice._id),
          paidAmount: invoice.paidAmount,
          dueAmount: invoice.dueAmount,
        },
        actorUserId,
      });
    }

    await sub.save();
    await this.syncDenormalizedLibrary(sub);
  }

  async promoteAllScheduledIfDue(): Promise<number> {
    const now = startOfDay(new Date());
    const due = await LibrarySubscriptionModel.find({
      upcomingPlanCode: { $exists: true, $nin: [null, ''] },
      upcomingStartDate: { $lte: now },
    }).select('libraryId');

    let promoted = 0;
    for (const row of due) {
      await this.promoteScheduledIfDue(row.libraryId as Types.ObjectId);
      promoted += 1;
    }
    return promoted;
  }

  async promoteScheduledIfDue(libraryId: Types.ObjectId): Promise<void> {
    const sub = await LibrarySubscriptionModel.findOne({ libraryId });
    if (!sub?.upcomingStartDate || !sub.upcomingPlanCode) return;
    const now = startOfDay(new Date());
    if (startOfDay(sub.upcomingStartDate).getTime() > now.getTime()) return;

    const previousPlan = sub.planCode;
    sub.status = SUBSCRIPTION_RECORD_STATUS.ACTIVE;
    sub.planId = sub.upcomingPlanId;
    sub.planCode = sub.upcomingPlanCode!;
    sub.planName = sub.upcomingPlanName ?? sub.planCode;
    sub.billingCycle = sub.upcomingBillingCycle ?? SUBSCRIPTION_RECORD_BILLING_CYCLE.MONTHLY;
    sub.startDate = sub.upcomingStartDate;
    sub.endDate = sub.upcomingEndDate;
    sub.trialEndsAt = null;
    sub.upcomingPlanId = null;
    sub.upcomingPlanCode = null;
    sub.upcomingPlanName = null;
    sub.upcomingBillingCycle = null;
    sub.upcomingStartDate = null;
    sub.upcomingEndDate = null;
    await sub.save();
    await this.syncDenormalizedLibrary(sub);
    await this.recordEvent({
      libraryId,
      type: SUBSCRIPTION_EVENT_TYPE.SUBSCRIPTION_ACTIVATED,
      title: 'Scheduled paid plan started',
      metadata: { previousPlan, planCode: sub.planCode },
    });
    await appendPlatformAuditLog({
      actorUserId: null,
      action: 'UPCOMING_SUBSCRIPTION_ACTIVATED',
      entityType: 'LIBRARY_SUBSCRIPTION',
      entityId: String(sub._id),
      libraryId: String(libraryId),
      metadata: { previousPlan, planCode: sub.planCode, module: 'subscription-billing' },
    });
  }

  async getPlatformSubscription(actor: AuthenticatedUser, libraryId: string) {
    assertSuperAdmin(actor);
    const oid = new Types.ObjectId(libraryId);
    await this.promoteScheduledIfDue(oid);
    const sub = await this.ensureFromLibrary(oid);
    const timeline = await this.buildTimeline(oid);
    const { buildLibrarySubscriptionSnapshot } = await import('./subscription-snapshot.builder');
    const snapshot = await buildLibrarySubscriptionSnapshot(libraryId);
    return {
      subscription: subscriptionToJson(sub),
      snapshot,
      timeline,
    };
  }

  async buildTimeline(libraryId: Types.ObjectId) {
    const [events, audits] = await Promise.all([
      SubscriptionEventModel.find({ libraryId }).sort({ createdAt: -1 }).limit(80).lean(),
      (
        await import('@modules/platform/audit-log.model')
      ).AuditLogModel.find({
        libraryId,
        action: {
          $in: [
            'SUBSCRIPTION_INVOICE_CREATE',
            'SUBSCRIPTION_INVOICE_COLLECT',
            'SUBSCRIPTION_INVOICE_CANCEL',
            SUBSCRIPTION_AUDIT_ACTION.SUBSCRIPTION_ADJUST,
            SUBSCRIPTION_AUDIT_ACTION.SUBSCRIPTION_EXTEND_TRIAL,
            SUBSCRIPTION_AUDIT_ACTION.SUBSCRIPTION_SYNC,
            'TENANT_SUSPEND',
            'TENANT_ACTIVATE',
          ],
        },
      })
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
    ]);

    const merged = [
      ...events.map((e) => ({
        id: String(e._id),
        source: 'event' as const,
        type: e.type,
        title: e.title,
        description: e.description,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
      ...audits.map((a) => ({
        id: String(a._id),
        source: 'audit' as const,
        type: a.action,
        title: a.action.replace(/_/g, ' '),
        description: null,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return merged.slice(0, 100);
  }

  async adjustSubscription(
    actor: AuthenticatedUser,
    libraryId: string,
    body: AdjustLibrarySubscriptionBody,
  ) {
    assertSuperAdmin(actor);
    if (body.adjustmentReason.trim().length < 3) {
      throw ApiError.unprocessable('Adjustment reason must be at least 3 characters');
    }
    const oid = new Types.ObjectId(libraryId);
    const sub = await this.ensureFromLibrary(oid);
    const before = subscriptionToJson(sub);

    if (body.planId) {
      const plan = await PlatformSubscriptionPlanModel.findById(body.planId).lean();
      if (!plan) throw ApiError.notFound('Plan not found');
      sub.planId = plan._id as Types.ObjectId;
      sub.planCode = plan.planKey;
      sub.planName = plan.displayName;
    }
    if (body.billingCycle !== undefined) sub.billingCycle = body.billingCycle;
    if (body.status !== undefined) {
      if (body.status === SUBSCRIPTION_RECORD_STATUS.ACTIVE && !sub.planId && !body.planId) {
        throw ApiError.unprocessable('Plan is required when setting status to ACTIVE');
      }
      sub.status = body.status;
    }
    if (body.startDate !== undefined) sub.startDate = dateOnlyUtc(body.startDate);
    if (body.endDate !== undefined) {
      sub.endDate = body.endDate
        ? new Date(Date.UTC(body.endDate.getUTCFullYear(), body.endDate.getUTCMonth(), body.endDate.getUTCDate(), 23, 59, 59, 999))
        : null;
    }
    if (body.trialEndsAt !== undefined) {
      sub.trialEndsAt = body.trialEndsAt
        ? new Date(Date.UTC(body.trialEndsAt.getUTCFullYear(), body.trialEndsAt.getUTCMonth(), body.trialEndsAt.getUTCDate(), 23, 59, 59, 999))
        : null;
    }
    if (body.graceEndsAt !== undefined) {
      sub.graceEndsAt = body.graceEndsAt
        ? new Date(Date.UTC(body.graceEndsAt.getUTCFullYear(), body.graceEndsAt.getUTCMonth(), body.graceEndsAt.getUTCDate(), 23, 59, 59, 999))
        : null;
    }
    if (body.dueAmount !== undefined) sub.dueAmount = roundMoney(body.dueAmount);
    if (body.currentInvoiceId !== undefined) {
      sub.currentInvoiceId = body.currentInvoiceId
        ? new Types.ObjectId(body.currentInvoiceId)
        : null;
    }

    sub.manuallyAdjusted = true;
    sub.adjustmentReason = body.adjustmentReason;
    sub.updatedBy = new Types.ObjectId(actor.id);
    await sub.save();
    await this.syncDenormalizedLibrary(sub);

    const after = subscriptionToJson(sub);
    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: SUBSCRIPTION_AUDIT_ACTION.SUBSCRIPTION_ADJUST,
      entityType: 'LIBRARY_SUBSCRIPTION',
      entityId: String(sub._id),
      libraryId,
      metadata: { before, after, reason: body.adjustmentReason, notes: body.notes ?? null },
    });
    await this.recordEvent({
      libraryId: oid,
      type: SUBSCRIPTION_EVENT_TYPE.SUBSCRIPTION_ADJUSTED,
      title: 'Subscription adjusted manually',
      description: body.adjustmentReason,
      metadata: { before, after },
      actorUserId: actor.id,
    });

    return { subscription: after, timeline: await this.buildTimeline(oid) };
  }

  async extendTrial(actor: AuthenticatedUser, libraryId: string, body: ExtendTrialBody) {
    assertSuperAdmin(actor);
    if (body.reason.trim().length < 3) {
      throw ApiError.unprocessable('Reason must be at least 3 characters');
    }
    const oid = new Types.ObjectId(libraryId);
    const sub = await this.ensureFromLibrary(oid);
    const before = sub.trialEndsAt;
    sub.trialEndsAt = endOfDay(body.trialEndsAt);
    sub.status = SUBSCRIPTION_RECORD_STATUS.TRIALING;
    sub.billingCycle = SUBSCRIPTION_RECORD_BILLING_CYCLE.TRIAL;
    sub.updatedBy = new Types.ObjectId(actor.id);
    await sub.save();
    await this.syncDenormalizedLibrary(sub);

    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: SUBSCRIPTION_AUDIT_ACTION.SUBSCRIPTION_EXTEND_TRIAL,
      entityType: 'LIBRARY_SUBSCRIPTION',
      entityId: String(sub._id),
      libraryId,
      metadata: { before, after: sub.trialEndsAt, reason: body.reason },
    });
    await this.recordEvent({
      libraryId: oid,
      type: SUBSCRIPTION_EVENT_TYPE.TRIAL_EXTENDED,
      title: 'Trial extended',
      description: body.reason,
      metadata: { trialEndsAt: sub.trialEndsAt },
      actorUserId: actor.id,
    });

    return { subscription: subscriptionToJson(sub), timeline: await this.buildTimeline(oid) };
  }

  async syncSubscription(actor: AuthenticatedUser, libraryId: string) {
    assertSuperAdmin(actor);
    const oid = new Types.ObjectId(libraryId);
    const lib = await LibraryModel.findById(oid).lean();
    if (!lib) throw ApiError.notFound('Library not found');

    const sub = await this.ensureFromLibrary(oid);
    const latestPaid = await PlatformSubscriptionInvoiceModel.findOne({
      libraryId: oid,
      status: PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID,
    })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();

    const openInv = await PlatformSubscriptionInvoiceModel.findOne({
      libraryId: oid,
      status: {
        $in: [
          PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID,
          PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL,
          PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
        ],
      },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (latestPaid) {
      sub.planId = latestPaid.planId as Types.ObjectId;
      sub.planCode = latestPaid.planCode;
      sub.planName = latestPaid.planName;
      sub.billingCycle = latestPaid.billingCycle;
      sub.startDate = latestPaid.subscriptionStartDate;
      sub.endDate = latestPaid.subscriptionEndDate;
      sub.lastPaymentId = latestPaid._id as Types.ObjectId;
      if (latestPaid.status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID) {
        const now = startOfDay(new Date());
        const future =
          startOfDay(latestPaid.subscriptionStartDate).getTime() > now.getTime() &&
          lib.status === LIBRARY_STATUS.TRIAL;
        if (!future) {
          sub.status = SUBSCRIPTION_RECORD_STATUS.ACTIVE;
          sub.upcomingPlanId = null;
          sub.upcomingPlanCode = null;
          sub.upcomingPlanName = null;
          sub.upcomingBillingCycle = null;
          sub.upcomingStartDate = null;
          sub.upcomingEndDate = null;
        }
      }
    }

    if (openInv) {
      sub.currentInvoiceId = openInv._id as Types.ObjectId;
      sub.amount = roundMoney(openInv.amount);
      sub.paidAmount = roundMoney(openInv.paidAmount);
      sub.dueAmount = roundMoney(openInv.dueAmount);
      if (openInv.status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL) {
        sub.status = SUBSCRIPTION_RECORD_STATUS.PAST_DUE;
      }
    }

    sub.updatedBy = new Types.ObjectId(actor.id);
    await sub.save();
    await this.promoteScheduledIfDue(oid);
    await this.syncDenormalizedLibrary(sub);

    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: SUBSCRIPTION_AUDIT_ACTION.SUBSCRIPTION_SYNC,
      entityType: 'LIBRARY_SUBSCRIPTION',
      entityId: String(sub._id),
      libraryId,
      metadata: { syncedAt: new Date().toISOString() },
    });
    await this.recordEvent({
      libraryId: oid,
      type: SUBSCRIPTION_EVENT_TYPE.SUBSCRIPTION_SYNCED,
      title: 'Subscription synced from invoices',
      actorUserId: actor.id,
    });

    return {
      subscription: subscriptionToJson(sub),
      timeline: await this.buildTimeline(oid),
    };
  }
}

export const librarySubscriptionService = new LibrarySubscriptionService();
