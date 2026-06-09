import {
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import type { ILibrary } from '@modules/library/library.model';
import { BILLING_CYCLE } from './subscription-billing.constants';
import { PLATFORM_SUBSCRIPTION_INVOICE_STATUS } from './subscription-billing.constants';
import { startOfDay } from './subscription-billing.helpers';

export const EXPIRY_STATE = {
  ACTIVE: 'ACTIVE',
  TRIAL: 'TRIAL',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  GRACE_PERIOD: 'GRACE_PERIOD',
  OVERDUE: 'OVERDUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type ExpiryState = (typeof EXPIRY_STATE)[keyof typeof EXPIRY_STATE];

export const LIBRARY_PLAN_TYPE = {
  TRIAL: 'TRIAL',
  BASIC: 'BASIC',
  GROWTH: 'GROWTH',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type LibraryPlanType = (typeof LIBRARY_PLAN_TYPE)[keyof typeof LIBRARY_PLAN_TYPE];

export const LIBRARY_BILLING_CYCLE = {
  TRIAL: 'TRIAL',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM',
} as const;
export type LibraryBillingCycle = (typeof LIBRARY_BILLING_CYCLE)[keyof typeof LIBRARY_BILLING_CYCLE];

const WARN_DAYS = 3;
const GRACE_DAYS = 2;

const PLAN_DISPLAY: Record<string, string> = {
  [SUBSCRIPTION_PLAN.BASIC]: 'Basic',
  [SUBSCRIPTION_PLAN.GROWTH]: 'Growth',
  [SUBSCRIPTION_PLAN.PROFESSIONAL]: 'Professional',
  [SUBSCRIPTION_PLAN.ENTERPRISE]: 'Enterprise',
  [SUBSCRIPTION_PLAN.FREE]: 'Trial',
  [SUBSCRIPTION_PLAN.STARTER]: 'Basic',
  TRIAL: 'Trial',
};

export function planDisplayName(planCode: string, catalogDisplayName?: string | null): string {
  if (catalogDisplayName?.trim()) return catalogDisplayName.trim();
  return PLAN_DISPLAY[planCode] ?? planCode;
}

export function normalizeLegacyPlanCode(planCode: string): string {
  if (planCode === SUBSCRIPTION_PLAN.FREE) return SUBSCRIPTION_PLAN.BASIC;
  if (planCode === SUBSCRIPTION_PLAN.STARTER) return SUBSCRIPTION_PLAN.BASIC;
  return planCode;
}

export type SubscriptionLifecycleInput = {
  status: string;
  subscriptionStatus?: string;
  subscriptionPlan: string;
  billingCycle?: string | null;
  subscriptionStartsAt?: Date | null;
  subscriptionEndsAt?: Date | null;
  trialEndsAt?: Date | null;
  graceEndsAt?: Date | null;
  suspendedAt?: Date | null;
  hasOverdueInvoice?: boolean;
  now?: Date;
};

export function resolveExpiryState(input: SubscriptionLifecycleInput): ExpiryState {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();
  const warnMs = WARN_DAYS * 86400000;
  const graceMs = GRACE_DAYS * 86400000;

  if (input.subscriptionStatus === SUBSCRIPTION_STATUS.CANCELLED) {
    return EXPIRY_STATE.CANCELLED;
  }
  if (input.status === LIBRARY_STATUS.SUSPENDED) {
    return EXPIRY_STATE.SUSPENDED;
  }
  if (input.hasOverdueInvoice || input.subscriptionStatus === SUBSCRIPTION_STATUS.PAST_DUE) {
    return EXPIRY_STATE.OVERDUE;
  }

  const trialEndMs = input.trialEndsAt ? new Date(input.trialEndsAt).getTime() : null;
  const subEndMs = input.subscriptionEndsAt ? new Date(input.subscriptionEndsAt).getTime() : null;
  const startMs = input.subscriptionStartsAt ? new Date(input.subscriptionStartsAt).getTime() : null;

  if (input.status === LIBRARY_STATUS.TRIAL || input.billingCycle === LIBRARY_BILLING_CYCLE.TRIAL) {
    if (trialEndMs && trialEndMs < nowMs) {
      if (trialEndMs + graceMs > nowMs) return EXPIRY_STATE.GRACE_PERIOD;
      return EXPIRY_STATE.EXPIRED;
    }
    if (trialEndMs && trialEndMs > nowMs && trialEndMs <= nowMs + warnMs) {
      return EXPIRY_STATE.EXPIRING_SOON;
    }
    return EXPIRY_STATE.TRIAL;
  }

  if (subEndMs && subEndMs < nowMs) {
    if (subEndMs + graceMs > nowMs) return EXPIRY_STATE.GRACE_PERIOD;
    return EXPIRY_STATE.EXPIRED;
  }

  if (subEndMs && subEndMs > nowMs && subEndMs <= nowMs + warnMs) {
    return EXPIRY_STATE.EXPIRING_SOON;
  }

  if (startMs && startMs <= nowMs) return EXPIRY_STATE.ACTIVE;
  return EXPIRY_STATE.ACTIVE;
}

/** Calendar-day difference (timezone-safe via startOfDay). */
export function daysRemainingCalendar(end: Date | null | undefined, now = new Date()): number | null {
  if (!end) return null;
  const endDay = startOfDay(new Date(end));
  const today = startOfDay(now);
  const diff = Math.ceil((endDay.getTime() - today.getTime()) / 86400000);
  return Math.max(0, diff);
}

/** @deprecated Use daysRemainingCalendar */
export function daysRemaining(end: Date | null | undefined, now = new Date()): number | null {
  return daysRemainingCalendar(end, now);
}

export function graceDaysRemainingCalendar(
  graceEndsAt: Date | null | undefined,
  subscriptionEndsAt: Date | null | undefined,
  now = new Date(),
): number | null {
  const graceEnd = graceEndsAt
    ? startOfDay(new Date(graceEndsAt))
    : subscriptionEndsAt
      ? (() => {
          const d = startOfDay(new Date(subscriptionEndsAt));
          d.setDate(d.getDate() + GRACE_DAYS);
          return d;
        })()
      : null;
  if (!graceEnd) return null;
  const today = startOfDay(now);
  const subEnd = subscriptionEndsAt ? startOfDay(new Date(subscriptionEndsAt)) : null;
  if (subEnd && today.getTime() <= subEnd.getTime()) return null;
  if (today.getTime() >= graceEnd.getTime()) return 0;
  return Math.max(0, Math.ceil((graceEnd.getTime() - today.getTime()) / 86400000));
}

/** @deprecated Use graceDaysRemainingCalendar */
export function graceDaysRemaining(
  subscriptionEndsAt: Date | null | undefined,
  now = new Date(),
): number | null {
  return graceDaysRemainingCalendar(null, subscriptionEndsAt, now);
}

export function buildBadgeLabel(params: {
  planName: string;
  expiryState: ExpiryState;
  daysRemaining: number | null;
  graceDaysRemaining: number | null;
  billingCycle?: string | null;
}): string {
  const plan = params.planName;
  const d = params.daysRemaining;
  const g = params.graceDaysRemaining;

  switch (params.expiryState) {
    case EXPIRY_STATE.TRIAL:
      return d != null ? `${plan} · Trial · ${d} day${d === 1 ? '' : 's'} left` : `${plan} · Trial`;
    case EXPIRY_STATE.EXPIRING_SOON:
      return d != null ? `${plan} · Expires in ${d} day${d === 1 ? '' : 's'}` : `${plan} · Expiring soon`;
    case EXPIRY_STATE.GRACE_PERIOD:
      return g != null
        ? `${plan} · Grace period · ${g} day${g === 1 ? '' : 's'} left`
        : `${plan} · Grace period`;
    case EXPIRY_STATE.OVERDUE:
      return `${plan} · Payment overdue`;
    case EXPIRY_STATE.SUSPENDED:
      return `${plan} · Suspended`;
    case EXPIRY_STATE.EXPIRED:
      return `${plan} · Expired`;
    case EXPIRY_STATE.CANCELLED:
      return `${plan} · Cancelled`;
    case EXPIRY_STATE.ACTIVE:
    default:
      return params.billingCycle && params.billingCycle !== BILLING_CYCLE.CUSTOM
        ? `${plan} · Active`
        : `${plan} · Active`;
  }
}

export type LibrarySubscriptionPayload = {
  planCode: string;
  planName: string;
  billingCycle: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  trialEndsAt: Date | null;
  daysRemaining: number | null;
  graceDaysRemaining: number | null;
  expiryState: ExpiryState;
  badgeLabel: string;
  currentInvoice: {
    id: string;
    invoiceNumber: string;
    amount: number;
    paidAmount: number;
    dueAmount: number;
    dueDate: Date;
    status: string;
  } | null;
  dueAmount: number;
  lastPaymentAt: Date | null;
  warningMessage: string | null;
};

type InvoiceLean = {
  _id: { toString(): string };
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: Date;
  status: string;
  billingCycle?: string;
};

export type SubscriptionPayloadLibInput = {
  status: string;
  subscriptionPlan: string;
  subscriptionStatus?: string;
  trialEndsAt?: Date | null;
  subscriptionEndsAt?: Date | null;
  subscriptionStartsAt?: Date | null;
  billingCycle?: string | null;
  graceEndsAt?: Date | null;
};

export function buildLibrarySubscriptionPayload(params: {
  lib: SubscriptionPayloadLibInput;
  planDisplayNameFromCatalog?: string | null;
  openDueTotal?: number;
  lastInvoice?: InvoiceLean | null;
  lastPaymentAt?: Date | null;
  hasOverdueInvoice?: boolean;
  now?: Date;
}): LibrarySubscriptionPayload {
  const now = params.now ?? new Date();
  const planCode = normalizeLegacyPlanCode(params.lib.subscriptionPlan);
  const planName =
    params.lib.status === LIBRARY_STATUS.TRIAL ||
    params.lib.billingCycle === LIBRARY_BILLING_CYCLE.TRIAL
      ? 'Trial'
      : planDisplayName(planCode, params.planDisplayNameFromCatalog);
  const billingCycle =
    params.lib.billingCycle ??
    params.lastInvoice?.billingCycle ??
    (params.lib.status === LIBRARY_STATUS.TRIAL ? LIBRARY_BILLING_CYCLE.TRIAL : null);

  const isTrialContext =
    params.lib.status === LIBRARY_STATUS.TRIAL || params.lib.billingCycle === LIBRARY_BILLING_CYCLE.TRIAL;

  const expiryState = resolveExpiryState({
    status: params.lib.status,
    subscriptionStatus: params.lib.subscriptionStatus,
    subscriptionPlan: planCode,
    billingCycle,
    subscriptionStartsAt: params.lib.subscriptionStartsAt ?? null,
    subscriptionEndsAt: params.lib.subscriptionEndsAt ?? null,
    trialEndsAt: params.lib.trialEndsAt ?? null,
    graceEndsAt: params.lib.graceEndsAt ?? null,
    hasOverdueInvoice: params.hasOverdueInvoice,
    now,
  });

  const paidEndDate = params.lib.subscriptionEndsAt ?? null;
  const trialEndDate = params.lib.trialEndsAt ?? null;

  let remain: number | null = null;
  let graceRemain: number | null = null;

  if (expiryState === EXPIRY_STATE.EXPIRED) {
    remain = 0;
  } else if (expiryState === EXPIRY_STATE.GRACE_PERIOD) {
    graceRemain = graceDaysRemainingCalendar(
      params.lib.graceEndsAt ?? null,
      paidEndDate,
      now,
    );
    remain = 0;
  } else if (isTrialContext || expiryState === EXPIRY_STATE.TRIAL) {
    remain = daysRemainingCalendar(trialEndDate, now);
  } else {
    remain = daysRemainingCalendar(paidEndDate, now);
    graceRemain = graceDaysRemainingCalendar(params.lib.graceEndsAt ?? null, paidEndDate, now);
  }

  const endDate = isTrialContext ? trialEndDate : paidEndDate;

  let warningMessage: string | null = null;
  if (expiryState === EXPIRY_STATE.EXPIRING_SOON) {
    if (params.lib.status === LIBRARY_STATUS.TRIAL) {
      warningMessage =
        remain != null
          ? `Your free trial ends in ${remain} day${remain === 1 ? '' : 's'}.`
          : 'Your free trial is ending soon.';
    } else {
      warningMessage =
        remain != null
          ? `Your subscription expires in ${remain} day${remain === 1 ? '' : 's'}. Please contact support.`
          : 'Your subscription is expiring soon.';
    }
  } else if (expiryState === EXPIRY_STATE.GRACE_PERIOD) {
    warningMessage =
      graceRemain != null
        ? `Subscription in grace period · ${graceRemain} day${graceRemain === 1 ? '' : 's'} left.`
        : 'Subscription is in grace period.';
  } else if (expiryState === EXPIRY_STATE.OVERDUE) {
    warningMessage = 'Subscription payment overdue · please clear outstanding invoices.';
  } else if (expiryState === EXPIRY_STATE.SUSPENDED) {
    warningMessage = 'Library suspended · contact support or renew subscription.';
  }

  const inv = params.lastInvoice;
  const openStatuses = [
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID,
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL,
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
  ];

  return {
    planCode,
    planName,
    billingCycle,
    status: params.lib.subscriptionStatus ?? '',
    startDate: params.lib.subscriptionStartsAt ?? null,
    endDate,
    trialEndsAt: params.lib.trialEndsAt ?? null,
    daysRemaining: remain,
    graceDaysRemaining: graceRemain,
    expiryState,
    badgeLabel: buildBadgeLabel({
      planName,
      expiryState,
      daysRemaining: remain,
      graceDaysRemaining: graceRemain,
      billingCycle,
    }),
    currentInvoice:
      inv &&
      openStatuses.includes(inv.status as (typeof openStatuses)[number])
        ? {
            id: String(inv._id),
            invoiceNumber: inv.invoiceNumber,
            amount: inv.amount,
            paidAmount: inv.paidAmount,
            dueAmount: inv.dueAmount,
            dueDate: inv.dueDate,
            status: inv.status,
          }
        : null,
    dueAmount: params.openDueTotal ?? 0,
    lastPaymentAt: params.lastPaymentAt ?? null,
    warningMessage,
  };
}
