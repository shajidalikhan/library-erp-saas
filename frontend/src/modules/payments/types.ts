import type { PaginationMeta } from '@/types/api';

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'WALLET' | 'OTHER';

export type InvoiceStatus =
  | 'DRAFT'
  | 'UNPAID'
  | 'PARTIAL'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'REFUNDED';

/** Mirrors backend `INVOICE_STATUSES` for filters and forms. */
export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'DRAFT',
  'UNPAID',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'REFUNDED',
];

export type FeePlanType =
  | 'REGISTRATION'
  | 'MEMBERSHIP'
  | 'REGISTRATION_PLUS_MEMBERSHIP'
  | 'CUSTOM';

export type MinimumStartAmountType = 'ONE_MONTH' | 'FIXED' | 'PERCENTAGE';

export type DowngradeStatus = 'NONE' | 'PENDING' | 'COMPLETED' | 'NOT_REQUIRED';

export interface FeePlan {
  _id: string;
  libraryId: string;
  branchId: string;
  name: string;
  type?: FeePlanType;
  amount: number;
  durationDays: number;
  billingDurationMonths?: number | null;
  shiftId?: string | null;
  allowManualPriceOverride?: boolean;
  allowPartialStart?: boolean;
  minimumStartAmountType?: MinimumStartAmountType | null;
  minimumStartAmount?: number | null;
  partialDueDays?: number | null;
  downgradeIfUnpaid?: boolean;
  downgradeDurationDays?: number;
  offerLabel?: string | null;
  description?: string;
  active: boolean;
  libraryName?: string | null;
  branchName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Invoice {
  _id: string;
  /** Same as `_id`; present on list responses for clarity. */
  invoiceId?: string;
  libraryId: string;
  branchId: string;
  studentId: string;
  seatId?: string | null;
  feePlanId?: string | null;
  invoiceNumber: string;
  amount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  refundTotal: number;
  dueAmount: number;
  status: InvoiceStatus;
  dueDate: string;
  notes?: string;
  membershipPeriodStart?: string | null;
  membershipPeriodEnd?: string | null;
  membershipId?: string | null;
  downgradeDueDate?: string | null;
  downgradeIfUnpaid?: boolean;
  selectedDurationDays?: number | null;
  downgradeDurationDays?: number | null;
  partialMinimumAmount?: number | null;
  currency: string;
  createdAt?: string;
  updatedAt?: string;
  /** Enriched list fields (GET /payments/invoices) */
  studentName?: string;
  studentCode?: string;
  studentPhone?: string;
  seatNumber?: string | null;
  branchName?: string;
  libraryName?: string | null;
  feePlanName?: string | null;
  lastPaymentId?: string | null;
  hasActivePayments?: boolean;
}

export interface PaymentRecord {
  _id: string;
  libraryId: string;
  branchId: string;
  studentId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  transactionId?: string;
  receiptNumber: string;
  receivedBy: string;
  paidAt: string;
  notes?: string;
  status: 'ACTIVE' | 'VOIDED';
  refundedAmount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentPortalWallet {
  studentId: string;
  currency: string;
  outstandingAmount: number;
  totalPaid: number;
  invoices: Invoice[];
  payments: PaymentRecord[];
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaymentSummaryResponse {
  period: { from: string; to: string; granularity: 'day' | 'month' };
  series: Array<{ _id: Record<string, unknown>; totalCollected: number; count: number }>;
  byBranch: Array<{
    _id?: string;
    branchId?: string;
    branchName?: string | null;
    branchCode?: string | null;
    totalCollected: number;
    count: number;
  }>;
}

export interface StudentPaymentHistoryResponse {
  student: Record<string, unknown>;
  invoices: Invoice[];
  payments: PaymentRecord[];
}
