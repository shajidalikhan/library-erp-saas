import { z } from 'zod';
import { Types } from 'mongoose';

import {
  SUBSCRIPTION_RECORD_BILLING_CYCLE,
  SUBSCRIPTION_RECORD_STATUS,
} from './library-subscription.constants';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid id' });

export const libraryIdParamsSchema = z.object({
  libraryId: objectIdString,
});

export const adjustLibrarySubscriptionBodySchema = z
  .object({
    planId: objectIdString.optional(),
    billingCycle: z.enum([
      SUBSCRIPTION_RECORD_BILLING_CYCLE.TRIAL,
      SUBSCRIPTION_RECORD_BILLING_CYCLE.MONTHLY,
      SUBSCRIPTION_RECORD_BILLING_CYCLE.YEARLY,
      SUBSCRIPTION_RECORD_BILLING_CYCLE.CUSTOM,
    ]).optional(),
    status: z.enum([
      SUBSCRIPTION_RECORD_STATUS.TRIALING,
      SUBSCRIPTION_RECORD_STATUS.ACTIVE,
      SUBSCRIPTION_RECORD_STATUS.PAST_DUE,
      SUBSCRIPTION_RECORD_STATUS.EXPIRED,
      SUBSCRIPTION_RECORD_STATUS.SUSPENDED,
      SUBSCRIPTION_RECORD_STATUS.CANCELLED,
    ]).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    trialEndsAt: z.coerce.date().optional().nullable(),
    graceEndsAt: z.coerce.date().optional().nullable(),
    dueAmount: z.coerce.number().min(0).optional(),
    currentInvoiceId: objectIdString.optional().nullable(),
    adjustmentReason: z.string().trim().min(3).max(2000),
    notes: z.string().trim().max(4000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate <= data.startDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'End date must be after start date',
        path: ['endDate'],
      });
    }
    if (data.status === SUBSCRIPTION_RECORD_STATUS.ACTIVE && !data.planId && !data.billingCycle) {
      ctx.addIssue({
        code: 'custom',
        message: 'Plan or billing cycle required when setting status to ACTIVE',
        path: ['planId'],
      });
    }
  });

export const extendTrialBodySchema = z.object({
  trialEndsAt: z.coerce.date(),
  reason: z.string().trim().min(3).max(2000),
});

export type AdjustLibrarySubscriptionBody = z.infer<typeof adjustLibrarySubscriptionBodySchema>;
export type ExtendTrialBody = z.infer<typeof extendTrialBodySchema>;
