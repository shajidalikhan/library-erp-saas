import type { FeePlan, MinimumStartAmountType } from '@/modules/payments/types';

export interface LibraryMembershipSettings {
  partialDueDays?: number;
  allowLongPlanPartialStart?: boolean;
  defaultDowngradeDurationDays?: number;
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

export function resolvePartialDueDays(plan: FeePlan, librarySettings?: LibraryMembershipSettings): number {
  return plan.partialDueDays ?? librarySettings?.partialDueDays ?? 7;
}

export function getMinimumStartAmount(plan: FeePlan, invoiceAmount: number): number {
  if (!plan.allowPartialStart) return invoiceAmount;
  const type: MinimumStartAmountType = plan.minimumStartAmountType ?? 'ONE_MONTH';
  if (type === 'FIXED') return plan.minimumStartAmount ?? invoiceAmount;
  if (type === 'PERCENTAGE') {
    const pct = plan.minimumStartAmount ?? 100;
    return Math.round(invoiceAmount * (pct / 100) * 100) / 100;
  }
  if (plan.minimumStartAmount != null && plan.minimumStartAmount > 0) {
    return plan.minimumStartAmount;
  }
  const months =
    plan.billingDurationMonths && plan.billingDurationMonths > 0
      ? plan.billingDurationMonths
      : Math.max(1, Math.round(plan.durationDays / 30));
  return Math.round((invoiceAmount / months) * 100) / 100;
}

/** @deprecated Use getMinimumStartAmount */
export const computeMinimumStartAmount = getMinimumStartAmount;

export function validateCollectPaymentAmount(params: {
  plan: FeePlan | null;
  invoiceTotal: number;
  paymentAmount: number;
  alreadyPaidAmount?: number;
  minimumOverride?: number | null;
  allowPartialStart?: boolean;
}): string | null {
  const { plan, invoiceTotal, paymentAmount, alreadyPaidAmount = 0, minimumOverride, allowPartialStart } =
    params;
  if (paymentAmount <= 0) return null;
  const newPaidTotal = alreadyPaidAmount + paymentAmount;
  if (newPaidTotal > invoiceTotal + 0.01) return 'Payment cannot exceed invoice total';
  if (newPaidTotal >= invoiceTotal - 0.01) return null;
  const partialAllowed = allowPartialStart ?? plan?.allowPartialStart ?? false;
  if (!partialAllowed) {
    return 'Full plan amount is required for this fee plan';
  }
  const minimum = minimumOverride ?? (plan ? getMinimumStartAmount(plan, invoiceTotal) : invoiceTotal);
  if (newPaidTotal < minimum - 0.01) {
    return `Minimum payment required is ₹${minimum.toLocaleString('en-IN')}.`;
  }
  return null;
}

export function formatPlanDurationLabel(plan: FeePlan): string {
  if (plan.offerLabel) return plan.offerLabel;
  if (plan.billingDurationMonths) return `${plan.billingDurationMonths} months`;
  return `${plan.durationDays} days`;
}
