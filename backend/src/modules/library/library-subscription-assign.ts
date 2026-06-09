import { Types } from 'mongoose';

import { ApiError } from '@utils/ApiError';
import { PlatformSettingModel } from '@modules/platform/platform-setting.model';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import {
  computeSubscriptionPeriod,
  startOfDay,
} from '@modules/subscription-billing/subscription-billing.helpers';
import {
  LIBRARY_BILLING_CYCLE,
  LIBRARY_PLAN_TYPE,
} from '@modules/subscription-billing/subscription-lifecycle.util';
import {
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from './library.constants';
import type { CreateLibraryInput } from './library.validation';

export type ResolvedLibrarySubscription = {
  status: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionStartsAt: Date;
  subscriptionEndsAt: Date | null;
  trialEndsAt: Date | null;
  billingCycle: string;
  planIdForInvoice: Types.ObjectId | null;
};

export async function getDefaultTrialDays(): Promise<number> {
  const s = await PlatformSettingModel.findOne({ singletonKey: 'default' })
    .select('defaultTrialDays')
    .lean();
  const n = s?.defaultTrialDays;
  return typeof n === 'number' && n >= 1 ? n : 14;
}

export async function resolveLibrarySubscriptionOnCreate(
  input: CreateLibraryInput,
): Promise<ResolvedLibrarySubscription> {
  const sub = input.subscription;
  if (!sub) throw ApiError.badRequest('Subscription assignment is required when creating a library');

  const start = startOfDay(sub.subscriptionStartDate);
  const isTrial =
    sub.planType === LIBRARY_PLAN_TYPE.TRIAL || sub.billingCycle === LIBRARY_BILLING_CYCLE.TRIAL;

  if (isTrial) {
    const trialDays = sub.trialDays ?? (await getDefaultTrialDays());
    const trialEnd = sub.trialEndsAt
      ? startOfDay(sub.trialEndsAt)
      : (() => {
          const d = new Date(start);
          d.setDate(d.getDate() + trialDays);
          return d;
        })();

    const plan = await PlatformSubscriptionPlanModel.findOne({
      planKey: SUBSCRIPTION_PLAN.BASIC,
      active: true,
    })
      .select('_id')
      .lean();

    return {
      status: LIBRARY_STATUS.TRIAL,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.TRIALING,
      subscriptionStartsAt: start,
      subscriptionEndsAt: null,
      trialEndsAt: trialEnd,
      billingCycle: LIBRARY_BILLING_CYCLE.TRIAL,
      planIdForInvoice: plan?._id ? (plan._id as Types.ObjectId) : null,
    };
  }

  const planKey = sub.planType;
  const plan = await PlatformSubscriptionPlanModel.findOne({ planKey, active: true }).lean();
  if (!plan) throw ApiError.badRequest(`Subscription plan ${planKey} is not available`);

  let subscriptionEndDate = sub.subscriptionEndDate
    ? startOfDay(sub.subscriptionEndDate)
    : null;

  if (!subscriptionEndDate) {
    const cycle =
      sub.billingCycle === LIBRARY_BILLING_CYCLE.MONTHLY
        ? 'MONTHLY'
        : sub.billingCycle === LIBRARY_BILLING_CYCLE.YEARLY
          ? 'YEARLY'
          : 'CUSTOM';
    const period = computeSubscriptionPeriod(
      start,
      cycle,
      sub.subscriptionEndDate,
    );
    subscriptionEndDate = period.subscriptionEndDate;
  }

  return {
    status: LIBRARY_STATUS.ACTIVE,
    subscriptionPlan: planKey,
    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    subscriptionStartsAt: start,
    subscriptionEndsAt: subscriptionEndDate,
    trialEndsAt: null,
    billingCycle: sub.billingCycle,
    planIdForInvoice: plan._id as Types.ObjectId,
  };
}
