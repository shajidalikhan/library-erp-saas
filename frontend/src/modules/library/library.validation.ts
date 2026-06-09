import { z } from 'zod';

const optionalPhone = z.string().trim().max(32).optional();

export const libraryFormSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .max(120)
    .refine((s) => s === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(s), 'Invalid slug'),
  ownerId: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: optionalPhone,
  gstNumber: z.string().trim().max(32).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(16).optional(),
  timezone: z.string().trim().max(64).optional(),
  subscriptionPlan: z.enum([
    'FREE',
    'STARTER',
    'BASIC',
    'GROWTH',
    'PROFESSIONAL',
    'ENTERPRISE',
  ]),
  status: z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED']),
  settingsJson: z.string().optional(),
  planType: z.enum(['TRIAL', 'BASIC', 'GROWTH', 'PROFESSIONAL', 'ENTERPRISE']).optional(),
  billingCycle: z.enum(['TRIAL', 'MONTHLY', 'YEARLY', 'CUSTOM']).optional(),
  subscriptionStartDate: z.string().optional(),
  subscriptionEndDate: z.string().optional(),
  trialDays: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().int().min(1).max(90).optional()),
  createInvoice: z.boolean().optional(),
  invoiceDueDate: z.string().optional(),
  paidAmount: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().min(0).optional()),
  invoiceAmount: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null) return undefined;
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().min(0).optional()),
});

export type LibraryFormValues = z.infer<typeof libraryFormSchema>;

export const librarySettingsFormSchema = z.object({
  settingsJson: z.string().min(2, 'Enter JSON object'),
});

export type LibrarySettingsFormValues = z.infer<typeof librarySettingsFormSchema>;

export const branchFormSchema = z.object({
  branchName: z.string().trim().min(2).max(200),
  branchCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, 'Alphanumeric code'),
  managerId: z.string().trim().optional(),
  email: z.string().trim().email(),
  phone: optionalPhone,
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(16).optional(),
  totalSeats: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? 0 : Number(val)),
    z.number().int().min(0),
  ),
  active: z.boolean(),
});

export type BranchFormValues = z.infer<typeof branchFormSchema>;
