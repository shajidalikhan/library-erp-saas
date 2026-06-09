import { ApiError } from '@utils/ApiError';

import type { MinimumStartAmountType } from '@modules/payments/fee-plan.constants';

const EPS = 0.009;

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LibraryMembershipSettings {
  partialDueDays?: number;
  allowLongPlanPartialStart?: boolean;
  defaultDowngradeDurationDays?: number;
}

export interface PartialPlanFeePlanLike {
  amount: number;
  durationDays: number;
  billingDurationMonths?: number | null;
  allowPartialStart?: boolean;
  minimumStartAmountType?: MinimumStartAmountType | null;
  minimumStartAmount?: number | null;
  /** Explicit one-month equivalent for ONE_MONTH minimum type. */
  oneMonthAmount?: number | null;
  partialDueDays?: number | null;
  downgradeIfUnpaid?: boolean;
  downgradeDurationDays?: number | null;
}

export interface ResolvedPartialPlanConfig {
  allowPartialStart: boolean;
  partialDueDays: number;
  downgradeIfUnpaid: boolean;
  downgradeDurationDays: number;
  minimumStartAmountType: MinimumStartAmountType;
  minimumStartAmount: number | null;
}

export function resolvePartialPlanConfig(
  plan: PartialPlanFeePlanLike,
  librarySettings?: LibraryMembershipSettings | null,
): ResolvedPartialPlanConfig {
  const allowPartialStart =
    plan.allowPartialStart ?? librarySettings?.allowLongPlanPartialStart ?? false;
  return {
    allowPartialStart,
    partialDueDays: plan.partialDueDays ?? librarySettings?.partialDueDays ?? 7,
    downgradeIfUnpaid: plan.downgradeIfUnpaid ?? true,
    downgradeDurationDays:
      plan.downgradeDurationDays ?? librarySettings?.defaultDowngradeDurationDays ?? 30,
    minimumStartAmountType: plan.minimumStartAmountType ?? 'ONE_MONTH',
    minimumStartAmount: plan.minimumStartAmount ?? null,
  };
}

/** Computes the minimum amount required to start a long-duration partial plan. */
export function getMinimumStartAmount(
  plan: PartialPlanFeePlanLike,
  invoiceAmount: number,
  config?: ResolvedPartialPlanConfig,
): number {
  const resolved = config ?? resolvePartialPlanConfig(plan);
  if (!resolved.allowPartialStart) return roundMoney(invoiceAmount);

  const type = resolved.minimumStartAmountType;
  if (type === 'FIXED') {
    return roundMoney(resolved.minimumStartAmount ?? invoiceAmount);
  }
  if (type === 'PERCENTAGE') {
    const pct = resolved.minimumStartAmount ?? 100;
    return roundMoney(invoiceAmount * (pct / 100));
  }

  // ONE_MONTH
  const oneMonth =
    plan.oneMonthAmount ??
    (resolved.minimumStartAmount != null && resolved.minimumStartAmount > 0
      ? resolved.minimumStartAmount
      : null);
  if (oneMonth != null && oneMonth > 0) {
    return roundMoney(oneMonth);
  }
  if (plan.billingDurationMonths && plan.billingDurationMonths > 0) {
    return roundMoney(invoiceAmount / plan.billingDurationMonths);
  }
  return roundMoney(invoiceAmount / Math.max(1, Math.ceil(plan.durationDays / 30)));
}

/** @deprecated Use getMinimumStartAmount */
export const computeMinimumStartAmount = getMinimumStartAmount;

export function minimumPaymentRequiredError(
  minimumRequired: number,
  paidAmount: number,
): ApiError {
  return ApiError.unprocessable(
    `Minimum payment required to start this plan is ₹${minimumRequired}.`,
    { minimumRequired, paidAmount },
  );
}

export function assertMinimumPartialPayment(params: {
  allowPartialStart: boolean;
  minimumRequired: number;
  paymentAmount: number;
  invoiceTotal: number;
  alreadyPaidAmount?: number;
}): void {
  const payment = roundMoney(params.paymentAmount);
  const total = roundMoney(params.invoiceTotal);
  if (payment <= 0) return;

  const alreadyPaid = roundMoney(params.alreadyPaidAmount ?? 0);
  const newPaidTotal = roundMoney(alreadyPaid + payment);

  if (payment > total + EPS) {
    throw ApiError.badRequest('Payment exceeds due amount');
  }

  if (newPaidTotal >= total - EPS) return;

  if (!params.allowPartialStart) {
    throw ApiError.unprocessable('Full plan amount is required for this fee plan', {
      minimumRequired: total,
      paidAmount: newPaidTotal,
    });
  }

  const minimum = roundMoney(params.minimumRequired);
  if (newPaidTotal < minimum - EPS) {
    throw minimumPaymentRequiredError(minimum, newPaidTotal);
  }
}

export function computePartialDueDate(from: Date, partialDueDays: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + partialDueDays);
  return d;
}

export function validatePartialPaymentAmount(params: {
  allowPartialStart: boolean;
  minimumStartAmount: number;
  paidAmount: number;
  invoiceTotal: number;
  alreadyPaidAmount?: number;
}): string | null {
  try {
    assertMinimumPartialPayment({
      allowPartialStart: params.allowPartialStart,
      minimumRequired: params.minimumStartAmount,
      paymentAmount: params.paidAmount,
      invoiceTotal: params.invoiceTotal,
      alreadyPaidAmount: params.alreadyPaidAmount,
    });
    return null;
  } catch (err) {
    if (err instanceof ApiError) return err.message;
    throw err;
  }
}

export function parseLibraryMembershipSettings(
  settings: Record<string, unknown> | null | undefined,
): LibraryMembershipSettings {
  const raw = settings?.membership;
  if (!raw || typeof raw !== 'object') return {};
  const m = raw as Record<string, unknown>;
  return {
    partialDueDays: typeof m.partialDueDays === 'number' ? m.partialDueDays : undefined,
    allowLongPlanPartialStart:
      typeof m.allowLongPlanPartialStart === 'boolean' ? m.allowLongPlanPartialStart : undefined,
    defaultDowngradeDurationDays:
      typeof m.defaultDowngradeDurationDays === 'number' ? m.defaultDowngradeDurationDays : undefined,
  };
}
