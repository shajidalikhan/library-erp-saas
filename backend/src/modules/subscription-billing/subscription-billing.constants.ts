export const BILLING_CYCLE = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  CUSTOM: 'CUSTOM',
} as const;
export type BillingCycle = (typeof BILLING_CYCLE)[keyof typeof BILLING_CYCLE];

export const PLATFORM_SUBSCRIPTION_INVOICE_STATUS = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;
export type PlatformSubscriptionInvoiceStatus =
  (typeof PLATFORM_SUBSCRIPTION_INVOICE_STATUS)[keyof typeof PLATFORM_SUBSCRIPTION_INVOICE_STATUS];

/** Display helper for badges (trial vs SaaS invoice lifecycle). */
export const SUBSCRIPTION_UI_STATUS = {
  ACTIVE: 'ACTIVE',
  TRIAL: 'TRIAL',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  GRACE_PERIOD: 'GRACE_PERIOD',
  OVERDUE: 'OVERDUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionUiStatus = (typeof SUBSCRIPTION_UI_STATUS)[keyof typeof SUBSCRIPTION_UI_STATUS];

export const SUBSCRIPTION_PAYMENT_METHOD = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  BANK_TRANSFER: 'BANK_TRANSFER',
  WALLET: 'WALLET',
  OTHER: 'OTHER',
} as const;
export type SubscriptionPaymentMethod =
  (typeof SUBSCRIPTION_PAYMENT_METHOD)[keyof typeof SUBSCRIPTION_PAYMENT_METHOD];

export const SUBSCRIPTION_PAYMENT_METHOD_VALUES = Object.values(SUBSCRIPTION_PAYMENT_METHOD);
