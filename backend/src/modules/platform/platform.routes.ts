import { Router } from 'express';

import { authenticate, requireSuperAdmin } from '@middlewares/auth.middleware';
import { impersonationContextPlaceholder } from '@middlewares/impersonation.middleware';
import { validate } from '@middlewares/validate.middleware';

import { platformController } from './platform.controller';
import { demoRequestController } from '@modules/demo-requests/demo-request.controller';
import {
  auditLogsQuerySchema,
  createSubscriptionPlanSchema,
  libraryIdParamsSchema,
  patchPlatformSettingsSchema,
  patchSubscriptionPlanSchema,
  patchTenantBodySchema,
  planIdParamsSchema,
  platformAnnouncementSchema,
  suspendTenantBodySchema,
  tenantsListQuerySchema,
} from './platform.validation';
import {
  demoRequestIdParamsSchema,
  demoRequestsListQuerySchema,
  patchDemoRequestSchema,
} from '@modules/demo-requests/demo-request.validation';
import { subscriptionBillingController } from '@modules/subscription-billing/subscription-billing.controller';
import {
  cancelPlatformSubscriptionInvoiceBodySchema,
  collectPlatformSubscriptionInvoiceBodySchema,
  createPlatformSubscriptionInvoiceBodySchema,
  platformSubscriptionInvoiceListQuerySchema,
  subscriptionInvoiceIdParamsSchema,
} from '@modules/subscription-billing/subscription-billing.validation';
import {
  adjustLibrarySubscriptionBodySchema,
  extendTrialBodySchema,
} from '@modules/subscription-billing/library-subscription.validation';
import {
  patchLibraryFeatureOverridesSchema,
  patchRoleCapabilitiesSchema,
} from './platform.validation';

/**
 * Mounted at `/platform` in `routes/index.ts` so super-admin middleware never
 * runs for unrelated paths like `/libraries/:id/branches`.
 */
const router = Router();

router.use(impersonationContextPlaceholder);
router.use(authenticate, requireSuperAdmin);

router.get('/dashboard', platformController.dashboard);
router.get('/health', platformController.health);
router.get('/settings', platformController.getSettings);
router.patch(
  '/settings',
  validate({ body: patchPlatformSettingsSchema }),
  platformController.patchSettings,
);

router.get('/tenants', validate({ query: tenantsListQuerySchema }), platformController.listTenants);
router.get(
  '/tenants/:libraryId',
  validate({ params: libraryIdParamsSchema }),
  platformController.getTenant,
);
router.patch(
  '/tenants/:libraryId',
  validate({ params: libraryIdParamsSchema, body: patchTenantBodySchema }),
  platformController.patchTenant,
);
router.patch(
  '/tenants/:libraryId/suspend',
  validate({ params: libraryIdParamsSchema, body: suspendTenantBodySchema }),
  platformController.suspendTenant,
);
router.patch(
  '/tenants/:libraryId/activate',
  validate({ params: libraryIdParamsSchema }),
  platformController.activateTenant,
);

router.get(
  '/tenants/:libraryId/subscription',
  validate({ params: libraryIdParamsSchema }),
  subscriptionBillingController.getPlatformLibrarySubscription,
);
router.get(
  '/tenants/:libraryId/subscription-snapshot',
  validate({ params: libraryIdParamsSchema }),
  subscriptionBillingController.getPlatformSubscriptionSnapshot,
);
router.patch(
  '/tenants/:libraryId/subscription/adjust',
  validate({ params: libraryIdParamsSchema, body: adjustLibrarySubscriptionBodySchema }),
  subscriptionBillingController.adjustPlatformLibrarySubscription,
);
router.post(
  '/tenants/:libraryId/subscription/extend-trial',
  validate({ params: libraryIdParamsSchema, body: extendTrialBodySchema }),
  subscriptionBillingController.extendPlatformTrial,
);
router.post(
  '/tenants/:libraryId/subscription/sync',
  validate({ params: libraryIdParamsSchema }),
  subscriptionBillingController.syncPlatformLibrarySubscription,
);
router.patch(
  '/tenants/:libraryId/feature-overrides',
  validate({ params: libraryIdParamsSchema, body: patchLibraryFeatureOverridesSchema }),
  platformController.patchTenantFeatureOverrides,
);

router.get('/subscriptions/plans', platformController.listPlans);
router.get(
  '/subscriptions/plans/:planId',
  validate({ params: planIdParamsSchema }),
  platformController.getPlan,
);
router.post(
  '/subscriptions/plans',
  validate({ body: createSubscriptionPlanSchema }),
  platformController.createPlan,
);
router.patch(
  '/subscriptions/plans/:planId',
  validate({ params: planIdParamsSchema, body: patchSubscriptionPlanSchema }),
  platformController.patchPlan,
);

router.post(
  '/subscription-invoices',
  validate({ body: createPlatformSubscriptionInvoiceBodySchema }),
  subscriptionBillingController.createPlatformInvoice,
);
router.get(
  '/subscription-invoices',
  validate({ query: platformSubscriptionInvoiceListQuerySchema }),
  subscriptionBillingController.listPlatformInvoices,
);
router.get(
  '/subscription-invoices/:invoiceId',
  validate({ params: subscriptionInvoiceIdParamsSchema }),
  subscriptionBillingController.getPlatformInvoice,
);
router.post(
  '/subscription-invoices/:invoiceId/collect',
  validate({
    params: subscriptionInvoiceIdParamsSchema,
    body: collectPlatformSubscriptionInvoiceBodySchema,
  }),
  subscriptionBillingController.collectPlatformInvoice,
);
router.patch(
  '/subscription-invoices/:invoiceId/cancel',
  validate({
    params: subscriptionInvoiceIdParamsSchema,
    body: cancelPlatformSubscriptionInvoiceBodySchema,
  }),
  subscriptionBillingController.cancelPlatformInvoice,
);

router.get('/audit-logs', validate({ query: auditLogsQuerySchema }), platformController.auditLogs);

router.get(
  '/demo-requests',
  validate({ query: demoRequestsListQuerySchema }),
  demoRequestController.list,
);
router.get(
  '/demo-requests/:requestId',
  validate({ params: demoRequestIdParamsSchema }),
  demoRequestController.get,
);
router.patch(
  '/demo-requests/:requestId',
  validate({ params: demoRequestIdParamsSchema, body: patchDemoRequestSchema }),
  demoRequestController.patch,
);

router.get('/usage', platformController.usage);
router.post('/usage/snapshots', platformController.usageSnapshots);

router.post(
  '/announcements',
  validate({ body: platformAnnouncementSchema }),
  platformController.announcement,
);

router.get('/impersonation/policy', platformController.impersonationPolicy);

router.get('/role-capabilities', platformController.getRoleCapabilities);
router.patch(
  '/role-capabilities',
  validate({ body: patchRoleCapabilitiesSchema }),
  platformController.patchRoleCapabilities,
);

export { router as platformRoutes };
