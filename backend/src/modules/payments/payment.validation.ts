import { z } from 'zod';
import { Types } from 'mongoose';

import {
  FEE_PLAN_SORT_FIELDS,
  INVOICE_SORT_FIELDS,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_SORT_FIELDS,
} from './payment.constants';
import { FEE_PLAN_TYPES, MINIMUM_START_AMOUNT_TYPES } from './fee-plan.constants';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

const optionalObjectId = z
  .union([objectIdString, z.literal('').transform(() => undefined), z.null()])
  .optional();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const feePlanListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  branchId: objectIdString.optional(),
  libraryId: objectIdString.optional(),
  type: z.enum(FEE_PLAN_TYPES).optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  sortBy: z.enum(FEE_PLAN_SORT_FIELDS).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createFeePlanBodySchema = z.object({
  /** Required when the caller is `SUPER_ADMIN` (validated in service). Ignored for tenant roles. */
  libraryId: optionalObjectId,
  branchId: objectIdString,
  name: z.string().trim().min(1).max(160),
  type: z.enum(FEE_PLAN_TYPES).optional().default('MEMBERSHIP'),
  amount: z.coerce.number().nonnegative(),
  durationDays: z.coerce.number().int().positive(),
  shiftId: optionalObjectId,
  allowManualPriceOverride: z.coerce.boolean().optional().default(false),
  billingDurationMonths: z.coerce.number().int().positive().optional().nullable(),
  allowPartialStart: z.coerce.boolean().optional().default(false),
  minimumStartAmountType: z.enum(MINIMUM_START_AMOUNT_TYPES).optional().nullable(),
  minimumStartAmount: z.coerce.number().nonnegative().optional().nullable(),
  partialDueDays: z.coerce.number().int().positive().optional().nullable(),
  downgradeIfUnpaid: z.coerce.boolean().optional().default(true),
  downgradeDurationDays: z.coerce.number().int().positive().optional().default(30),
  offerLabel: z.string().trim().max(160).optional().nullable(),
  description: z.string().trim().max(2000).optional(),
  active: z.coerce.boolean().optional().default(true),
});

export const updateFeePlanBodySchema = createFeePlanBodySchema.partial().omit({ branchId: true, libraryId: true });

export const feePlanIdParamsSchema = z.object({
  feePlanId: objectIdString,
});

export const createInvoiceBodySchema = z.object({
  /** Required when the caller is `SUPER_ADMIN` (validated in service). Ignored for tenant roles. */
  libraryId: optionalObjectId,
  branchId: objectIdString,
  studentId: objectIdString,
  seatId: optionalObjectId,
  feePlanId: optionalObjectId,
  amount: z.coerce.number().nonnegative().optional(),
  discountAmount: z.coerce.number().nonnegative().optional().default(0),
  taxAmount: z.coerce.number().nonnegative().optional().default(0),
  dueDate: z.coerce.date(),
  notes: z.string().trim().max(5000).optional(),
  status: z.enum(['DRAFT', 'UNPAID']).optional().default('UNPAID'),
  membershipPeriodStart: z.coerce.date().optional().nullable(),
  membershipPeriodEnd: z.coerce.date().optional().nullable(),
}).superRefine((v, ctx) => {
  if (!v.feePlanId && v.amount === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'amount is required when feePlanId is not provided',
      path: ['amount'],
    });
  }
});

export const invoiceListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  studentId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  libraryId: objectIdString.optional(),
  seatId: objectIdString.optional(),
  invoiceId: objectIdString.optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  hasOpenBalance: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  overdueOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  downgradePending: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  downgraded: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  sortBy: z.enum(INVOICE_SORT_FIELDS).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const invoiceIdParamsSchema = z.object({
  invoiceId: objectIdString,
});

export const updateInvoiceBodySchema = z.object({
  discountAmount: z.coerce.number().nonnegative().optional(),
  taxAmount: z.coerce.number().nonnegative().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().trim().max(5000).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  seatId: optionalObjectId,
  membershipPeriodStart: z.coerce.date().optional().nullable(),
  membershipPeriodEnd: z.coerce.date().optional().nullable(),
}).refine((o) => Object.keys(o).length > 0, { message: 'At least one field required' });

export const collectPaymentBodySchema = z.object({
  skipMembershipExtension: z.coerce.boolean().optional().default(false),
  invoiceId: objectIdString,
  amount: z.coerce.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  transactionId: z.string().trim().max(200).optional(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().max(2000).optional(),
  allowOverpayment: z.coerce.boolean().optional().default(false),
});

export const paymentListQuerySchema = paginationQuerySchema.extend({
  studentId: objectIdString.optional(),
  invoiceId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  libraryId: objectIdString.optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(PAYMENT_SORT_FIELDS).optional().default('paidAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const paymentIdParamsSchema = z.object({
  paymentId: objectIdString,
});

export const refundBodySchema = z.object({
  paymentId: objectIdString,
  amount: z.coerce.number().positive(),
  reason: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const studentHistoryParamsSchema = z.object({
  studentId: objectIdString,
});

export const paymentSummaryQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  granularity: z.enum(['day', 'month']).optional().default('day'),
  branchId: objectIdString.optional(),
  libraryId: objectIdString.optional(),
});

export type FeePlanListQuery = z.infer<typeof feePlanListQuerySchema>;
export type CreateFeePlanInput = z.infer<typeof createFeePlanBodySchema>;
export type UpdateFeePlanInput = z.infer<typeof updateFeePlanBodySchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceBodySchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceBodySchema>;
export type CollectPaymentInput = z.infer<typeof collectPaymentBodySchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
export type RefundInput = z.infer<typeof refundBodySchema>;
export type PaymentSummaryQuery = z.infer<typeof paymentSummaryQuerySchema>;
