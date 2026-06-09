import { z } from 'zod';

export const libraryCreateSubscriptionSchema = z
  .object({
    planType: z.enum(['TRIAL', 'BASIC', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE']),
    billingCycle: z.enum(['TRIAL', 'MONTHLY', 'YEARLY', 'CUSTOM']),
    subscriptionStartDate: z.string().min(1, 'Start date is required'),
    subscriptionEndDate: z.string().optional(),
    trialDays: z.coerce.number().int().min(1).max(90).optional(),
    createInvoice: z.boolean().optional(),
    invoiceDueDate: z.string().optional(),
    paidAmount: z.coerce.number().min(0).optional(),
    amount: z.coerce.number().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    const isTrial = data.planType === 'TRIAL' || data.billingCycle === 'TRIAL';
    if (isTrial && !data.trialDays) {
      ctx.addIssue({
        code: 'custom',
        message: 'Trial days required (default 14)',
        path: ['trialDays'],
      });
    }
    if (data.billingCycle === 'CUSTOM' && !data.subscriptionEndDate?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'End date required for custom billing',
        path: ['subscriptionEndDate'],
      });
    }
    if (data.createInvoice && !data.invoiceDueDate?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invoice due date required',
        path: ['invoiceDueDate'],
      });
    }
  });

export type LibraryCreateSubscriptionValues = z.infer<typeof libraryCreateSubscriptionSchema>;
