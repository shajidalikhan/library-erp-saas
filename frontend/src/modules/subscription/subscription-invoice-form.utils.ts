export type BillingCycle = 'MONTHLY' | 'YEARLY' | 'CUSTOM';

export type PlatformPlanOption = {
  id: string;
  planKey: string;
  displayName: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxSeats: number;
  maxBranches: number;
  maxStaff: number;
  storageLimitMb: number;
  featureFlags?: Record<string, boolean>;
  sortOrder?: number;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseInputDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayInputDate(): string {
  return toInputDate(new Date());
}

export function addDaysInputDate(base: string, days: number): string {
  const d = parseInputDate(base);
  d.setDate(d.getDate() + days);
  return toInputDate(d);
}

export function planAmountForCycle(plan: PlatformPlanOption, cycle: BillingCycle): number {
  if (cycle === 'MONTHLY') return plan.monthlyPrice;
  if (cycle === 'YEARLY') return plan.yearlyPrice;
  return Math.max(plan.monthlyPrice, plan.yearlyPrice);
}

export function computeSubscriptionDates(params: {
  billingCycle: BillingCycle;
  subscriptionStartDate: string;
  customEndDate?: string;
}): { start: string; end: string } {
  const start = parseInputDate(params.subscriptionStartDate);
  if (params.billingCycle === 'CUSTOM' && params.customEndDate) {
    return {
      start: toInputDate(start),
      end: toInputDate(parseInputDate(params.customEndDate)),
    };
  }
  const end = new Date(start);
  if (params.billingCycle === 'MONTHLY') {
    end.setMonth(end.getMonth() + 1);
  } else if (params.billingCycle === 'YEARLY') {
    end.setFullYear(end.getFullYear() + 1);
  }
  return { start: toInputDate(start), end: toInputDate(end) };
}

export function computeRenewalStartFromLibrary(lib: {
  status: string;
  subscriptionEndsAt?: string | null;
  trialEndsAt?: string | null;
  startPaidNow?: boolean;
  startAfterTrial?: boolean;
}): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (lib.status === 'TRIAL' && lib.trialEndsAt) {
    if (lib.startPaidNow) return toInputDate(now);
    if (lib.startAfterTrial !== false) return toInputDate(parseInputDate(lib.trialEndsAt));
    return toInputDate(now);
  }
  if (lib.subscriptionEndsAt) {
    const end = parseInputDate(lib.subscriptionEndsAt);
    if (end >= now) {
      const next = new Date(end);
      next.setDate(next.getDate() + 1);
      return toInputDate(next);
    }
  }
  return toInputDate(now);
}

export function deriveInvoicePreviewStatus(
  amount: number,
  paidAmount: number,
  dueDate: string,
): 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' {
  const dueLeft = Math.round((amount - paidAmount) * 100) / 100;
  if (dueLeft <= 0) return 'PAID';
  const dueMs = parseInputDate(dueDate).getTime();
  if (Date.now() > dueMs) return 'OVERDUE';
  if (paidAmount > 0) return 'PARTIAL';
  return 'UNPAID';
}

export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'WALLET', label: 'Wallet' },
  { value: 'OTHER', label: 'Other' },
] as const;
