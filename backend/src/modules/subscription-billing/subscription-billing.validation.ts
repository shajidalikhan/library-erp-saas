import { z } from 'zod';
import { Types } from 'mongoose';

import { paginationQuerySchema } from '@modules/payments/payment.validation';

import { BILLING_CYCLE } from './subscription-billing.constants';
import { PLATFORM_SUBSCRIPTION_INVOICE_STATUS } from './subscription-billing.constants';
import { SUBSCRIPTION_PAYMENT_METHOD_VALUES } from './subscription-billing.constants';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid library or plan selection' });

export const subscriptionInvoiceIdParamsSchema = z.object({
  invoiceId: objectIdString,
});

export const createPlatformSubscriptionInvoiceBodySchema = z
  .object({
    libraryId: objectIdString,
    planId: objectIdString,
    billingCycle: z.enum([BILLING_CYCLE.MONTHLY, BILLING_CYCLE.YEARLY, BILLING_CYCLE.CUSTOM]),
    amount: z.coerce.number().min(0).optional(),
    amountOverride: z.boolean().optional().default(false),
    allowOverpayment: z.boolean().optional().default(false),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    subscriptionStartDate: z.coerce.date().optional(),
    subscriptionEndDate: z.coerce.date().optional(),
    startPaidAfterTrial: z.boolean().optional(),
    startPaidNow: z.boolean().optional(),
    paidAmount: z.coerce.number().min(0).optional().default(0),
    paymentMethod: z.enum(SUBSCRIPTION_PAYMENT_METHOD_VALUES).optional(),
    transactionId: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .superRefine((data, ctx) => {
    const issueMs = data.issueDate.getTime();
    const dueMs = data.dueDate.getTime();
    if (dueMs < issueMs) {
      ctx.addIssue({
        code: 'custom',
        message: 'Due date must be on or after issue date',
        path: ['dueDate'],
      });
    }

    if (data.billingCycle === BILLING_CYCLE.CUSTOM) {
      if (!data.subscriptionEndDate) {
        ctx.addIssue({
          code: 'custom',
          message: 'Subscription end date is required for CUSTOM billing cycle',
          path: ['subscriptionEndDate'],
        });
      } else if (data.subscriptionStartDate && data.subscriptionEndDate <= data.subscriptionStartDate) {
        ctx.addIssue({
          code: 'custom',
          message: 'Subscription end date must be after start date',
          path: ['subscriptionEndDate'],
        });
      }
    }

    if (data.subscriptionStartDate && data.subscriptionEndDate) {
      if (data.subscriptionEndDate.getTime() <= data.subscriptionStartDate.getTime()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Subscription end date must be after start date',
          path: ['subscriptionEndDate'],
        });
      }
    }

    const amount = data.amount ?? 0;
    const paid = data.paidAmount ?? 0;
    if (!data.allowOverpayment && paid > amount + 0.001) {
      ctx.addIssue({
        code: 'custom',
        message: 'Paid amount cannot exceed invoice amount unless overpayment is allowed',
        path: ['paidAmount'],
      });
    }
  });

export const platformSubscriptionInvoiceListQuerySchema = paginationQuerySchema.extend({
  libraryId: objectIdString.optional(),
  planId: objectIdString.optional(),
  billingCycle: z.enum([BILLING_CYCLE.MONTHLY, BILLING_CYCLE.YEARLY, BILLING_CYCLE.CUSTOM]).optional(),
  status: z.enum([
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID,
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL,
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID,
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
    PLATFORM_SUBSCRIPTION_INVOICE_STATUS.CANCELLED,
  ]).optional(),
  overdueOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  search: z.string().trim().max(120).optional(),
  sortBy: z.enum(['createdAt', 'dueDate', 'amount']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const collectPlatformSubscriptionInvoiceBodySchema = z.object({
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(SUBSCRIPTION_PAYMENT_METHOD_VALUES).optional(),
  transactionId: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const cancelPlatformSubscriptionInvoiceBodySchema = z.preprocess(
  (raw) => (raw === undefined || raw === null ? {} : raw),
  z.object({
    notes: z.string().trim().max(2000).optional(),
  }),
);

export const ownerSubscriptionInvoiceListQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum([
      PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID,
      PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL,
      PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID,
      PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
      PLATFORM_SUBSCRIPTION_INVOICE_STATUS.CANCELLED,
    ])
    .optional(),
});

export type CreatePlatformSubscriptionInvoiceBody = z.infer<
  typeof createPlatformSubscriptionInvoiceBodySchema
>;
export type PlatformSubscriptionInvoiceListQuery = z.infer<
  typeof platformSubscriptionInvoiceListQuerySchema
>;
export type CollectPlatformSubscriptionInvoiceBody = z.infer<
  typeof collectPlatformSubscriptionInvoiceBodySchema
>;
export type CancelPlatformSubscriptionInvoiceBody = z.infer<
  typeof cancelPlatformSubscriptionInvoiceBodySchema
>;
export type OwnerSubscriptionInvoiceListQuery = z.infer<typeof ownerSubscriptionInvoiceListQuerySchema>;
