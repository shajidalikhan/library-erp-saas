import type { BillingCycle } from './subscription-billing.constants';
import { BILLING_CYCLE } from './subscription-billing.constants';
import {
  PLATFORM_SUBSCRIPTION_INVOICE_STATUS,
  type PlatformSubscriptionInvoiceStatus,
} from './subscription-billing.constants';

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Calendar date at UTC midnight (stable for admin date overrides). */
export function dateOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export function addYears(d: Date, years: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + years);
  return x;
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function computeSubscriptionPeriod(
  issueOrStart: Date,
  billingCycle: BillingCycle,
  customEnd?: Date,
): { subscriptionStartDate: Date; subscriptionEndDate: Date } {
  const subscriptionStartDate = startOfDay(issueOrStart);
  if (billingCycle === BILLING_CYCLE.CUSTOM) {
    if (!customEnd) throw new Error('CUSTOM billing requires subscriptionEndDate');
    return { subscriptionStartDate, subscriptionEndDate: endOfDay(customEnd) };
  }
  if (billingCycle === BILLING_CYCLE.MONTHLY) {
    return { subscriptionStartDate, subscriptionEndDate: addMonths(subscriptionStartDate, 1) };
  }
  return { subscriptionStartDate, subscriptionEndDate: addYears(subscriptionStartDate, 1) };
}

/** Next renewal period start: day after current end if still active, else today. */
export function computeRenewalPeriodStart(
  library: {
    status: string;
    subscriptionEndsAt?: Date | null;
    trialEndsAt?: Date | null;
  },
  options?: { startAfterTrial?: boolean; startPaidNow?: boolean },
): Date {
  const now = startOfDay(new Date());
  if (library.status === 'TRIAL' && library.trialEndsAt) {
    if (options?.startPaidNow) return now;
    if (options?.startAfterTrial !== false) {
      const next = new Date(library.trialEndsAt);
      next.setDate(next.getDate() + 1);
      return startOfDay(next);
    }
    return now;
  }
  const end = library.subscriptionEndsAt ? new Date(library.subscriptionEndsAt) : null;
  if (end && end.getTime() >= now.getTime()) {
    const next = new Date(end);
    next.setDate(next.getDate() + 1);
    return startOfDay(next);
  }
  return now;
}

export function addDaysToDate(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function derivePreviewInvoiceStatus(
  amount: number,
  paidAmount: number,
  dueDate: Date,
  now = new Date(),
): (typeof PLATFORM_SUBSCRIPTION_INVOICE_STATUS)[keyof typeof PLATFORM_SUBSCRIPTION_INVOICE_STATUS] {
  return deriveOpenInvoiceStatus({ amount, paidAmount, dueDate, now });
}

export function deriveOpenInvoiceStatus(params: {
  amount: number;
  paidAmount: number;
  dueDate: Date;
  now?: Date;
}): (typeof PLATFORM_SUBSCRIPTION_INVOICE_STATUS)[keyof typeof PLATFORM_SUBSCRIPTION_INVOICE_STATUS] {
  const now = params.now ?? new Date();
  const dueLeft = roundMoney(params.amount - params.paidAmount);
  if (dueLeft <= 0) return PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID;
  if (now.getTime() > params.dueDate.getTime()) return PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE;
  if (params.paidAmount > 0) return PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL;
  return PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID;
}
