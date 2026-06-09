import { z } from 'zod';
import { Types } from 'mongoose';

import { logoFieldSchemaZod, optionalMediaAssetSchemaZod } from '@utils/media-asset.validation';

import {
  LIBRARY_BILLING_CYCLE,
  LIBRARY_PLAN_TYPE,
} from '@modules/subscription-billing/subscription-lifecycle.util';
import {
  BRANCH_SORT_FIELDS,
  LIBRARY_SORT_FIELDS,
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN_VALUES,
} from './library.constants';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

const optionalObjectId = z
  .union([objectIdString, z.literal('').transform(() => undefined), z.undefined()])
  .optional();

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{7,20}$/, 'Invalid phone format')
  .optional();

const emailSchema = z.string().trim().toLowerCase().email('Invalid email format');

const settingsRecord = z.record(z.string(), z.unknown()).optional().default({});

export const listLibrariesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(LIBRARY_SORT_FIELDS).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  status: z.enum([LIBRARY_STATUS.ACTIVE, LIBRARY_STATUS.TRIAL, LIBRARY_STATUS.SUSPENDED]).optional(),
  country: z.string().trim().max(120).optional(),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLAN_VALUES).optional(),
  billingCycle: z
    .enum([
      LIBRARY_BILLING_CYCLE.TRIAL,
      LIBRARY_BILLING_CYCLE.MONTHLY,
      LIBRARY_BILLING_CYCLE.YEARLY,
      LIBRARY_BILLING_CYCLE.CUSTOM,
    ])
    .optional(),
  expiryState: z
    .enum([
      'ACTIVE',
      'TRIAL',
      'EXPIRING_SOON',
      'EXPIRED',
      'GRACE_PERIOD',
      'SUSPENDED',
      'CANCELLED',
    ])
    .optional(),
  expiringWithinDays: z.coerce.number().int().min(1).max(30).optional(),
});

const libraryPlanTypeValues = [
  LIBRARY_PLAN_TYPE.TRIAL,
  LIBRARY_PLAN_TYPE.BASIC,
  LIBRARY_PLAN_TYPE.GROWTH,
  LIBRARY_PLAN_TYPE.PROFESSIONAL,
  LIBRARY_PLAN_TYPE.ENTERPRISE,
] as const;

const libraryBillingCycleValues = [
  LIBRARY_BILLING_CYCLE.TRIAL,
  LIBRARY_BILLING_CYCLE.MONTHLY,
  LIBRARY_BILLING_CYCLE.YEARLY,
  LIBRARY_BILLING_CYCLE.CUSTOM,
] as const;

export const librarySubscriptionAssignSchema = z
  .object({
    planType: z.union([
      z.enum(libraryPlanTypeValues),
      z
        .string()
        .trim()
        .min(2)
        .max(40)
        .transform((s) => s.toUpperCase()),
    ]),
    billingCycle: z.enum(libraryBillingCycleValues),
    subscriptionStartDate: z.coerce.date(),
    subscriptionEndDate: z.coerce.date().optional(),
    trialEndsAt: z.coerce.date().optional(),
    trialDays: z.coerce.number().int().min(1).max(90).optional(),
    dueDate: z.coerce.date().optional(),
    createInvoice: z.boolean().optional().default(false),
    invoiceDueDate: z.coerce.date().optional(),
    paidAmount: z.coerce.number().min(0).optional(),
    amount: z.coerce.number().min(0).optional(),
    paymentMethod: z.string().trim().max(120).optional(),
  })
  .superRefine((data, ctx) => {
    const isTrial =
      data.planType === LIBRARY_PLAN_TYPE.TRIAL || data.billingCycle === LIBRARY_BILLING_CYCLE.TRIAL;
    if (isTrial && !data.trialEndsAt && !data.trialDays) {
      ctx.addIssue({
        code: 'custom',
        message: 'trialEndsAt or trialDays is required for trial subscriptions',
        path: ['trialEndsAt'],
      });
    }
    if (data.billingCycle === LIBRARY_BILLING_CYCLE.CUSTOM && !data.subscriptionEndDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'subscriptionEndDate is required when billingCycle is CUSTOM',
        path: ['subscriptionEndDate'],
      });
    }
    if (data.createInvoice && !data.invoiceDueDate && !data.dueDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'invoiceDueDate or dueDate is required when createInvoice is true',
        path: ['invoiceDueDate'],
      });
    }
  });

export const createLibrarySchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, 'Slug must be alphanumeric segments separated by hyphens')
    .transform((s) => s.toLowerCase())
    .optional(),
  ownerId: objectIdString.optional(),
  email: emailSchema,
  phone: phoneSchema,
  gstNumber: z.string().trim().max(32).optional(),
  logo: logoFieldSchemaZod,
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(16).optional(),
  timezone: z.string().trim().max(64).optional(),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLAN_VALUES).optional(),
  status: z
    .enum([LIBRARY_STATUS.ACTIVE, LIBRARY_STATUS.TRIAL, LIBRARY_STATUS.SUSPENDED])
    .optional(),
  settings: settingsRecord,
  subscription: librarySubscriptionAssignSchema,
});

export const updateLibrarySchema = createLibrarySchema
  .omit({ ownerId: true })
  .partial()
  .extend({
    ownerId: optionalObjectId,
  });

const publicPhotoSchema = z.object({
  url: z.string().trim().url(),
  publicId: z.string().trim().min(1).max(256),
  caption: z.string().trim().max(200).optional(),
  isCover: z.boolean().optional(),
  order: z.coerce.number().int().min(0).optional(),
});

export const patchLibrarySettingsSchema = z.object({
  settings: z
    .record(z.string(), z.unknown())
    .superRefine((settings, ctx) => {
      const publicPage = settings.publicBookingPage;
      if (!publicPage || typeof publicPage !== 'object') return;
      const photos = (publicPage as { publicPhotos?: unknown }).publicPhotos;
      if (photos === undefined) return;
      if (!Array.isArray(photos)) {
        ctx.addIssue({
          code: 'custom',
          message: 'publicPhotos must be an array',
          path: ['publicBookingPage', 'publicPhotos'],
        });
        return;
      }
      if (photos.length > 10) {
        ctx.addIssue({
          code: 'custom',
          message: 'Maximum 10 public photos are allowed',
          path: ['publicBookingPage', 'publicPhotos'],
        });
      }
      photos.forEach((photo, index) => {
        const parsed = publicPhotoSchema.safeParse(photo);
        if (!parsed.success) {
          ctx.addIssue({
            code: 'custom',
            message: `Invalid public photo at index ${index}`,
            path: ['publicBookingPage', 'publicPhotos', index],
          });
        }
      });

      const membership = settings.membership;
      if (membership !== undefined && membership !== null && typeof membership !== 'object') {
        ctx.addIssue({
          code: 'custom',
          message: 'membership settings must be an object',
          path: ['membership'],
        });
      }
      if (membership && typeof membership === 'object') {
        const m = membership as Record<string, unknown>;
        if (m.partialDueDays !== undefined && typeof m.partialDueDays !== 'number') {
          ctx.addIssue({ code: 'custom', message: 'partialDueDays must be a number', path: ['membership', 'partialDueDays'] });
        }
        if (
          m.defaultDowngradeDurationDays !== undefined &&
          typeof m.defaultDowngradeDurationDays !== 'number'
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'defaultDowngradeDurationDays must be a number',
            path: ['membership', 'defaultDowngradeDurationDays'],
          });
        }
      }
    }),
});

export const libraryIdParamsSchema = z.object({
  libraryId: objectIdString,
});

export const branchIdParamsSchema = z.object({
  libraryId: objectIdString,
  branchId: objectIdString,
});

export const listBranchesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().trim().max(200).optional(),
  sortBy: z.enum(BRANCH_SORT_FIELDS).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  city: z.string().trim().max(120).optional(),
});

export const createBranchSchema = z.object({
  branchName: z.string().trim().min(2).max(200),
  branchCode: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9_-]+$/i, 'Branch code must be alphanumeric')
    .transform((s) => s.toUpperCase()),
  managerId: optionalObjectId,
  email: emailSchema,
  phone: phoneSchema,
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  pincode: z.string().trim().max(16).optional(),
  totalSeats: z.coerce.number().int().min(0).optional().default(0),
  active: z.coerce.boolean().optional().default(true),
  logo: optionalMediaAssetSchemaZod,
});

export const updateBranchSchema = createBranchSchema.partial();

export type ListLibrariesQuery = z.infer<typeof listLibrariesQuerySchema>;
export type CreateLibraryInput = z.infer<typeof createLibrarySchema>;
export type UpdateLibraryInput = z.infer<typeof updateLibrarySchema>;
export type PatchLibrarySettingsInput = z.infer<typeof patchLibrarySettingsSchema>;
export type ListBranchesQuery = z.infer<typeof listBranchesQuerySchema>;
export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const deleteLibraryBodySchema = z.object({
  confirmPhrase: z.string().trim().min(1, 'Confirmation phrase is required'),
});

export type DeleteLibraryInput = z.infer<typeof deleteLibraryBodySchema>;
