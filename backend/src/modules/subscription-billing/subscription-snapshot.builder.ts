import { Types } from 'mongoose';

import { ApiError } from '@utils/ApiError';
import { LibraryModel } from '@modules/library/library.models';
import {
  LIBRARY_STATUS,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import { librarySubscriptionService } from './library-subscription.service';
import { resolveSubscriptionPlan } from './subscription-plan-resolve.util';
import { subscriptionLimitService, type LibraryUsageSnapshot } from './subscription-limit.service';
import { subscriptionFeatureService } from './subscription-feature.service';
import { PlatformSubscriptionInvoiceModel } from './platform-subscription-invoice.model';
import {
  PLATFORM_SUBSCRIPTION_INVOICE_STATUS,
  SUBSCRIPTION_UI_STATUS,
} from './subscription-billing.constants';
import { roundMoney, startOfDay } from './subscription-billing.helpers';
import { loadPlatformSupportConfig } from '@modules/platform/platform-settings.support';
import { buildLibrarySubscriptionPayload, EXPIRY_STATE, type ExpiryState } from './subscription-lifecycle.util';
import { SUBSCRIPTION_RECORD_STATUS } from './library-subscription.constants';

export type LibrarySubscriptionSnapshot = {
  syncedAt: string;
  uiStatus: string;
  expiryState: ExpiryState;
  badgeLabel: string;
  warningMessage: string | null;
  plan: {
    id: string | null;
    code: string;
    displayName: string;
    billingCycle: string | null;
  };
  status: string;
  billingCycle: string | null;
  startDate: Date | null;
  endDate: Date | null;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  daysRemaining: number | null;
  graceDaysRemaining: number | null;
  isTrial: boolean;
  subscription: ReturnType<typeof buildLibrarySubscriptionPayload>;
  subscriptionRecord: {
    manuallyAdjusted: boolean;
    adjustmentReason: string | null;
    recordStatus: string;
    upcoming: {
      planId: string | null;
      planCode: string;
      planName: string | null;
      billingCycle: string | null;
      startDate: Date;
      endDate: Date | null;
      phase?: string;
    } | null;
    subscriptionPhase?: string;
  } | null;
  financial: {
    dueAmountTotal: number;
    lastPaymentAt: Date | null;
    currentInvoice: {
      id: string;
      invoiceNumber: string;
      amount: number;
      paidAmount: number;
      dueAmount: number;
      dueDate: Date;
      status: string;
    } | null;
  };
  usage: LibraryUsageSnapshot;
  usageStatus: string;
  library: {
    name: string;
    status: string;
    subscriptionStatus: string;
  };
  dates: {
    subscriptionStartsAt: Date | null;
    trialEndsAt: Date | null;
    subscriptionEndsAt: Date | null;
    renewalDate: Date | null;
  };
  remaining: {
    trialDaysRemaining: number | null;
    subscriptionDaysRemaining: number | null;
    subscriptionGraceDaysRemaining: number | null;
  };
  support: Record<string, unknown>;
  featureFlags: Record<string, boolean>;
  featureAccess: {
    planId: string | null;
    planCode: string;
    planName: string;
    planFeatures: Record<string, boolean>;
    features: Record<string, boolean>;
    included: Array<{ key: string; label: string }>;
    unavailable: Array<{ key: string; label: string }>;
    enabledFeaturesOverride: string[];
    disabledFeaturesOverride: string[];
  };
  warnings: string[];
};

function expiryStateToUiStatus(
  state: ExpiryState,
): (typeof SUBSCRIPTION_UI_STATUS)[keyof typeof SUBSCRIPTION_UI_STATUS] {
  const map: Record<ExpiryState, (typeof SUBSCRIPTION_UI_STATUS)[keyof typeof SUBSCRIPTION_UI_STATUS]> = {
    [EXPIRY_STATE.ACTIVE]: SUBSCRIPTION_UI_STATUS.ACTIVE,
    [EXPIRY_STATE.TRIAL]: SUBSCRIPTION_UI_STATUS.TRIAL,
    [EXPIRY_STATE.EXPIRING_SOON]: SUBSCRIPTION_UI_STATUS.EXPIRING_SOON,
    [EXPIRY_STATE.EXPIRED]: SUBSCRIPTION_UI_STATUS.EXPIRED,
    [EXPIRY_STATE.GRACE_PERIOD]: SUBSCRIPTION_UI_STATUS.GRACE_PERIOD,
    [EXPIRY_STATE.OVERDUE]: SUBSCRIPTION_UI_STATUS.OVERDUE,
    [EXPIRY_STATE.SUSPENDED]: SUBSCRIPTION_UI_STATUS.SUSPENDED,
    [EXPIRY_STATE.CANCELLED]: SUBSCRIPTION_UI_STATUS.CANCELLED,
  };
  return map[state] ?? SUBSCRIPTION_UI_STATUS.ACTIVE;
}

function mapRecordStatusToLibraryStatus(
  recordStatus: string,
  libraryStatus: string,
  hasScheduledPaid: boolean,
): { status: string; subscriptionStatus: string } {
  if (libraryStatus === LIBRARY_STATUS.SUSPENDED) {
    return { status: LIBRARY_STATUS.SUSPENDED, subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE };
  }
  if (recordStatus === SUBSCRIPTION_RECORD_STATUS.CANCELLED) {
    return { status: LIBRARY_STATUS.SUSPENDED, subscriptionStatus: SUBSCRIPTION_STATUS.CANCELLED };
  }
  if (recordStatus === SUBSCRIPTION_RECORD_STATUS.TRIALING) {
    return { status: LIBRARY_STATUS.TRIAL, subscriptionStatus: SUBSCRIPTION_STATUS.TRIALING };
  }
  if (recordStatus === SUBSCRIPTION_RECORD_STATUS.PAST_DUE) {
    return { status: LIBRARY_STATUS.ACTIVE, subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE };
  }
  if (recordStatus === SUBSCRIPTION_RECORD_STATUS.SUSPENDED) {
    return { status: LIBRARY_STATUS.SUSPENDED, subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE };
  }
  if (recordStatus === SUBSCRIPTION_RECORD_STATUS.EXPIRED) {
    return { status: LIBRARY_STATUS.ACTIVE, subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE };
  }
  return { status: LIBRARY_STATUS.ACTIVE, subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE };
}

/** Single computed snapshot for platform, owner billing, badges, and modals. */
export async function buildLibrarySubscriptionSnapshot(
  libraryId: string,
): Promise<LibrarySubscriptionSnapshot> {
  const lib = await LibraryModel.findById(libraryId).lean();
  if (!lib) throw ApiError.notFound('Library not found');

  const oid = lib._id as Types.ObjectId;
  await librarySubscriptionService.promoteScheduledIfDue(oid);
  const subRecord = await librarySubscriptionService.ensureFromLibrary(oid);

  const now = new Date();
  const hasUpcomingPlan = Boolean(
    subRecord.upcomingStartDate &&
      subRecord.upcomingPlanCode &&
      startOfDay(subRecord.upcomingStartDate).getTime() > startOfDay(now).getTime(),
  );
  const hasScheduledPaid = hasUpcomingPlan;

  const { status: derivedStatus, subscriptionStatus } = mapRecordStatusToLibraryStatus(
    subRecord.status,
    lib.status,
    hasScheduledPaid,
  );

  const resolvedPlan = await resolveSubscriptionPlan({
    planId: subRecord.planId,
    planCode: subRecord.planCode,
    planName: subRecord.planName,
  });

  if (
    subRecord.planId &&
    (subRecord.planCode !== resolvedPlan.code || subRecord.planName !== resolvedPlan.displayName)
  ) {
    subRecord.planCode = resolvedPlan.code;
    subRecord.planName = resolvedPlan.displayName;
    await subRecord.save();
    if (lib.subscriptionPlan !== resolvedPlan.code) {
      await LibraryModel.updateOne({ _id: oid }, { $set: { subscriptionPlan: resolvedPlan.code } });
    }
  }

  let upcomingResolved: Awaited<ReturnType<typeof resolveSubscriptionPlan>> | null = null;
  if (subRecord.upcomingPlanId) {
    upcomingResolved = await resolveSubscriptionPlan({
      planId: subRecord.upcomingPlanId,
      planCode: subRecord.upcomingPlanCode,
      planName: subRecord.upcomingPlanName,
    });
    if (
      subRecord.upcomingPlanCode !== upcomingResolved.code ||
      subRecord.upcomingPlanName !== upcomingResolved.displayName
    ) {
      subRecord.upcomingPlanCode = upcomingResolved.code;
      subRecord.upcomingPlanName = upcomingResolved.displayName;
      await subRecord.save();
    }
  }

  const openStatuses = [
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID,
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL,
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
  ];

  const [usageSnapshot, featureAccess, support, openDueAgg, openInv, hasOverdue, lastPaid] =
    await Promise.all([
    subscriptionLimitService.getUsageSnapshot(libraryId),
    subscriptionFeatureService.resolveEffectiveFeatures(libraryId),
    loadPlatformSupportConfig(),
    PlatformSubscriptionInvoiceModel.aggregate<{ t: number }>([
      {
        $match: {
          libraryId: oid,
          status: { $nin: [PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID, PLATFORM_SUBSCRIPTION_INVOICE_STATUS.CANCELLED] },
        },
      },
      { $group: { _id: null, t: { $sum: '$dueAmount' } } },
    ]),
    PlatformSubscriptionInvoiceModel.findOne({
      libraryId: oid,
      status: { $in: openStatuses },
    })
      .sort({ createdAt: -1 })
      .lean(),
    PlatformSubscriptionInvoiceModel.exists({
      libraryId: oid,
      status: PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
      dueAmount: { $gt: 0 },
    }),
    PlatformSubscriptionInvoiceModel.findOne({ libraryId: oid, paidAt: { $ne: null } })
      .sort({ paidAt: -1 })
      .select('paidAt amount invoiceNumber')
      .lean(),
  ]);

  const openDueTotal = roundMoney(
    subRecord.dueAmount > 0 ? subRecord.dueAmount : (openDueAgg[0]?.t ?? 0),
  );

  const isTrial =
    derivedStatus === LIBRARY_STATUS.TRIAL ||
    subRecord.status === SUBSCRIPTION_RECORD_STATUS.TRIALING ||
    hasScheduledPaid;

  const subscriptionStartsAt = subRecord.startDate;
  const subscriptionEndsAt = isTrial && !hasScheduledPaid ? subRecord.endDate : subRecord.endDate;
  const trialEndsAt = subRecord.trialEndsAt;
  const graceEndsAt = subRecord.graceEndsAt;

  const subscription = buildLibrarySubscriptionPayload({
    lib: {
      status: derivedStatus,
      subscriptionPlan: resolvedPlan.code,
      subscriptionStatus,
      trialEndsAt,
      subscriptionEndsAt: isTrial ? null : subscriptionEndsAt,
      subscriptionStartsAt,
      billingCycle: hasScheduledPaid ? 'TRIAL' : subRecord.billingCycle,
      graceEndsAt,
    },
    planDisplayNameFromCatalog: resolvedPlan.displayName,
    openDueTotal,
    lastInvoice: openInv as never,
    lastPaymentAt: lastPaid?.paidAt ?? null,
    hasOverdueInvoice: Boolean(hasOverdue),
    now,
  });

  const subscriptionView = {
    ...subscription,
    planCode: resolvedPlan.code,
    planName: resolvedPlan.displayName,
  };

  const warnings: string[] = [];
  if (subscription.warningMessage) warnings.push(subscription.warningMessage);
  if (isTrial && subscription.daysRemaining != null && subscription.daysRemaining <= 3) {
    warnings.push(`Trial ends in ${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? '' : 's'}.`);
  }
  if (openDueTotal > 0) {
    warnings.push(`Outstanding subscription balance: ₹${openDueTotal}.`);
  }
  if (usageSnapshot.usageStatus === 'OVER_LIMIT') {
    warnings.push(
      'You are over your plan limit. Upgrade your plan to continue creating new branches, seats, staff, or students.',
    );
  } else if (usageSnapshot.usageStatus === 'WARNING') {
    warnings.push('You are approaching your plan limits. Consider upgrading before you hit the cap.');
  }

  const uiStatus = expiryStateToUiStatus(subscription.expiryState);

  return {
    syncedAt: new Date().toISOString(),
    uiStatus,
    expiryState: subscription.expiryState,
    badgeLabel: subscription.badgeLabel,
    warningMessage: subscription.warningMessage,
    plan: {
      id: resolvedPlan.planId,
      code: resolvedPlan.code,
      displayName: resolvedPlan.displayName,
      billingCycle: subscription.billingCycle,
    },
    status: subscription.status,
    billingCycle: subscription.billingCycle,
    startDate: subscriptionStartsAt,
    endDate: subscription.endDate,
    trialEndsAt: subscription.trialEndsAt,
    graceEndsAt,
    daysRemaining: subscription.daysRemaining,
    graceDaysRemaining: subscription.graceDaysRemaining,
    isTrial,
    subscription: subscriptionView,
    subscriptionRecord: {
      manuallyAdjusted: subRecord.manuallyAdjusted,
      adjustmentReason: subRecord.adjustmentReason,
      recordStatus: subRecord.status,
      upcoming:
        hasUpcomingPlan && subRecord.upcomingStartDate && upcomingResolved
          ? {
              planId: upcomingResolved.planId,
              planCode: upcomingResolved.code,
              planName: upcomingResolved.displayName,
              billingCycle: subRecord.upcomingBillingCycle,
              startDate: subRecord.upcomingStartDate,
              endDate: subRecord.upcomingEndDate,
              phase: 'UPCOMING',
            }
          : null,
      subscriptionPhase: hasUpcomingPlan ? 'UPCOMING_SCHEDULED' : 'ACTIVE',
    },
    financial: {
      dueAmountTotal: openDueTotal,
      lastPaymentAt: subscription.lastPaymentAt,
      currentInvoice: subscription.currentInvoice,
    },
    usage: usageSnapshot,
    usageStatus: usageSnapshot.usageStatus,
    library: {
      name: lib.name,
      status: lib.status,
      subscriptionStatus,
    },
    dates: {
      subscriptionStartsAt,
      trialEndsAt,
      subscriptionEndsAt,
      renewalDate: subscriptionEndsAt,
    },
    remaining: {
      trialDaysRemaining: isTrial ? subscription.daysRemaining : null,
      subscriptionDaysRemaining: !isTrial ? subscription.daysRemaining : null,
      subscriptionGraceDaysRemaining: subscription.graceDaysRemaining,
    },
    support: support as Record<string, unknown>,
    featureFlags: featureAccess.features,
    featureAccess: {
      planId: resolvedPlan.planId,
      planCode: resolvedPlan.code,
      planName: resolvedPlan.displayName,
      planFeatures: featureAccess.planFeatures,
      features: featureAccess.features,
      included: featureAccess.included,
      unavailable: featureAccess.unavailable,
      enabledFeaturesOverride: featureAccess.enabledFeaturesOverride,
      disabledFeaturesOverride: featureAccess.disabledFeaturesOverride,
    },
    warnings,
  };
}
