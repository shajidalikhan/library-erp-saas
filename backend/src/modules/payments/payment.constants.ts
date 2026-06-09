export const PAYMENT_METHODS = [
  'CASH',
  'UPI',
  'CARD',
  'BANK_TRANSFER',
  'WALLET',
  'OTHER',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const INVOICE_STATUSES = [
  'DRAFT',
  'UNPAID',
  'PARTIAL',
  'PAID',
  'OVERDUE',
  'CANCELLED',
  'REFUNDED',
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_RECORD_STATUSES = ['ACTIVE', 'VOIDED'] as const;
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number];

export const REFUND_STATUSES = ['COMPLETED', 'CANCELLED'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const FEE_PLAN_SORT_FIELDS = ['createdAt', 'name', 'amount'] as const;
export type FeePlanSortField = (typeof FEE_PLAN_SORT_FIELDS)[number];

export const INVOICE_SORT_FIELDS = ['createdAt', 'dueDate', 'totalAmount', 'dueAmount', 'invoiceNumber'] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export const PAYMENT_SORT_FIELDS = ['paidAt', 'createdAt', 'amount'] as const;
export type PaymentSortField = (typeof PAYMENT_SORT_FIELDS)[number];
