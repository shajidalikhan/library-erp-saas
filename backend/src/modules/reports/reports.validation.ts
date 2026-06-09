import { z } from 'zod';
import { Types } from 'mongoose';

import { INVOICE_STATUSES, PAYMENT_METHODS } from '@modules/payments/payment.constants';

import { paginationQuerySchema } from '@modules/payments/payment.validation';

const invoiceStatuses = INVOICE_STATUSES as unknown as [string, ...string[]];

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

export const REPORT_RANGE = ['7d', '30d', '90d', '365d', 'custom'] as const;
export type ReportRangePreset = (typeof REPORT_RANGE)[number];

export const reportListQuerySchema = paginationQuerySchema.extend({
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  range: z.enum(REPORT_RANGE).optional().default('30d'),
  search: z.string().trim().max(200).optional(),
  status: z.string().trim().max(64).optional(),
  studentId: objectIdString.optional(),
  seatId: objectIdString.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  invoiceStatus: z.enum(invoiceStatuses).optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ReportListQuery = z.infer<typeof reportListQuerySchema>;

export const reportExportQuerySchema = reportListQuerySchema.extend({
  format: z.enum(['csv', 'xlsx', 'pdf']),
  columns: z.string().trim().max(2000).optional(),
});

export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;
