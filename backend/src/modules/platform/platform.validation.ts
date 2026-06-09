import { z } from 'zod';

import { paginationQuerySchema } from '@modules/payments/payment.validation';
import {
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN_VALUES,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import { AUDIT_ACTIONS, ENTITY_TYPES } from './platform.constants';
import { isValidPlanKey, sanitizePlanKey } from './platform-catalog-plan.util';
import { SUBSCRIPTION_FEATURE_KEYS_SET } from '@modules/subscription-billing/subscription-feature-catalog';
import {
  CONFIGURABLE_STAFF_ROLES,
  ROLE_CAPABILITY_MODULES,
} from '@constants/role-capabilities.constants';

const objectIdString = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const libraryIdParamsSchema = z.object({
  libraryId: objectIdString,
});

export const planIdParamsSchema = z.object({
  planId: objectIdString,
});

export const tenantsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  status: z.enum([LIBRARY_STATUS.ACTIVE, LIBRARY_STATUS.TRIAL, LIBRARY_STATUS.SUSPENDED]).optional(),
  subscriptionPlan: z.enum(SUBSCRIPTION_PLAN_VALUES).optional(),
  billingCycle: z.enum(['TRIAL', 'MONTHLY', 'YEARLY', 'CUSTOM']).optional(),
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
  sortBy: z.enum(['createdAt', 'name', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const patchTenantBodySchema = z.object({
  subscriptionPlan: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((s) => s.toUpperCase())
    .optional(),
  subscriptionStatus: z.enum([
    SUBSCRIPTION_STATUS.TRIALING,
    SUBSCRIPTION_STATUS.ACTIVE,
    SUBSCRIPTION_STATUS.PAST_DUE,
    SUBSCRIPTION_STATUS.CANCELLED,
  ]).optional(),
  trialEndsAt: z.coerce.date().nullable().optional(),
  status: z.enum([LIBRARY_STATUS.ACTIVE, LIBRARY_STATUS.TRIAL, LIBRARY_STATUS.SUSPENDED]).optional(),
});

export const suspendTenantBodySchema = z.object({
  reason: z.string().trim().min(3).max(2000),
});

export const patchPlatformSettingsSchema = z.object({
  supportEmail: z.string().trim().email().max(200).optional(),
  salesEmail: z.string().trim().email().max(200).optional(),
  demoRequestNotifyEmail: z.string().trim().email().max(200).optional(),
  supportPhone: z.string().trim().max(32).optional(),
  billingPhone: z.string().trim().max(32).optional(),
  whatsappSupport: z.string().trim().max(32).optional(),
  showSupportEmail: z.boolean().optional(),
  showSupportPhone: z.boolean().optional(),
  showWhatsappSupport: z.boolean().optional(),
  showSalesEmail: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  impersonationNotes: z.string().trim().max(2000).optional(),
});

const nonNegativeInt = z.coerce.number().int().min(0);

/** Only catalog keys allowed on `PlatformSubscriptionPlan.featureFlags`. */
export const subscriptionPlanFeatureFlagsBodySchema = z
  .record(z.string(), z.boolean())
  .superRefine((obj, ctx) => {
    for (const key of Object.keys(obj)) {
      if (!SUBSCRIPTION_FEATURE_KEYS_SET.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: `Unknown subscription plan feature flag: ${key}`,
          path: [key],
        });
      }
    }
  });

const subscriptionPlanLimitsSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  perfectFor: z.string().trim().max(300).optional(),
  highlights: z.array(z.string().trim().max(200)).max(12).optional(),
  maxStudents: nonNegativeInt,
  maxBranches: nonNegativeInt,
  maxSeats: nonNegativeInt,
  maxStaff: nonNegativeInt,
  storageLimitMb: nonNegativeInt,
  featureFlags: subscriptionPlanFeatureFlagsBodySchema.optional(),
  monthlyPrice: z.coerce.number().min(0),
  yearlyPrice: z.coerce.number().min(0),
  currency: z.string().trim().min(3).max(8).transform((s) => s.toUpperCase()).optional(),
  active: z.boolean().optional(),
  mostPopular: z.boolean().optional(),
  publicVisible: z.boolean().optional(),
  trialDays: z.coerce.number().int().min(0).max(90).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

const planKeyField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .transform((s) => sanitizePlanKey(s))
  .refine((s) => s.length >= 2, 'Plan key must be at least 2 characters')
  .refine((s) => isValidPlanKey(s), 'Plan key must use A-Z, 0-9, and underscores only');

export const createSubscriptionPlanSchema = subscriptionPlanLimitsSchema.extend({
  planKey: planKeyField,
});

export const patchSubscriptionPlanSchema = subscriptionPlanLimitsSchema.partial().extend({
  planKey: planKeyField.optional(),
});

export const auditLogsQuerySchema = paginationQuerySchema.extend({
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  actorUserId: objectIdString.optional(),
  module: z.string().trim().max(80).optional(),
  severity: z.enum(['info', 'warning', 'critical']).optional(),
  showAll: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((v) => v === true || v === 'true'),
  q: z.string().trim().max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const platformAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(200),
  message: z.string().trim().min(2).max(8000),
  type: z.enum(['ANNOUNCEMENT', 'SYSTEM']).default('ANNOUNCEMENT'),
});

const featureOverrideKeysSchema = z
  .array(z.string())
  .superRefine((arr, ctx) => {
    for (let i = 0; i < arr.length; i += 1) {
      if (!SUBSCRIPTION_FEATURE_KEYS_SET.has(arr[i]!)) {
        ctx.addIssue({
          code: 'custom',
          message: `Unknown feature key: ${arr[i]}`,
          path: [i],
        });
      }
    }
  });

export const patchLibraryFeatureOverridesSchema = z.object({
  enabledFeaturesOverride: featureOverrideKeysSchema.optional(),
  disabledFeaturesOverride: featureOverrideKeysSchema.optional(),
  reason: z.string().trim().min(3).max(500),
});

export type TenantsListQuery = z.infer<typeof tenantsListQuerySchema>;
export type PatchTenantBody = z.infer<typeof patchTenantBodySchema>;
export type SuspendTenantBody = z.infer<typeof suspendTenantBodySchema>;
export type PatchPlatformSettingsBody = z.infer<typeof patchPlatformSettingsSchema>;
export type CreateSubscriptionPlanBody = z.infer<typeof createSubscriptionPlanSchema>;
export type PatchSubscriptionPlanBody = z.infer<typeof patchSubscriptionPlanSchema>;
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
export type PlatformAnnouncementBody = z.infer<typeof platformAnnouncementSchema>;
export type PatchLibraryFeatureOverridesBody = z.infer<typeof patchLibraryFeatureOverridesSchema>;

const configurableRoleEnum = z.enum(
  CONFIGURABLE_STAFF_ROLES as unknown as [string, ...string[]],
);

const roleModulePatchShape = Object.fromEntries(
  ROLE_CAPABILITY_MODULES.map((mod) => [mod, z.boolean()]),
) as Record<(typeof ROLE_CAPABILITY_MODULES)[number], z.ZodBoolean>;

const actionPatchShape = Object.fromEntries(
  ROLE_CAPABILITY_MODULES.map((mod) => [
    mod,
    z.record(z.string(), z.boolean()).optional(),
  ]),
) as Record<(typeof ROLE_CAPABILITY_MODULES)[number], z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodBoolean>>>;

export const patchRoleCapabilitiesSchema = z
  .object({
    role: configurableRoleEnum,
    modules: z.object(roleModulePatchShape).partial().optional(),
    actions: z.object(actionPatchShape).partial().optional(),
  })
  .refine((body) => Boolean(body.modules || body.actions), {
    message: 'Provide modules and/or actions to update',
  });

export type PatchRoleCapabilitiesBody = z.infer<typeof patchRoleCapabilitiesSchema>;
