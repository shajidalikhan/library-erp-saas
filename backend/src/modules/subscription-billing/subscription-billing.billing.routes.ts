import { Router } from 'express';

import { ROLES } from '@constants/roles.constants';
import { authenticate } from '@middlewares/auth.middleware';
import { requireRole } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { loadPlatformSupportConfig } from '@modules/platform/platform-settings.support';

import { subscriptionBillingController } from './subscription-billing.controller';
import {
  ownerSubscriptionInvoiceListQuerySchema,
  subscriptionInvoiceIdParamsSchema,
} from './subscription-billing.validation';

/**
 * Owner SaaS billing — mounted at `/billing`.
 */
const router = Router();

router.use(authenticate);

router.get(
  '/support-config',
  asyncHandler(async (_req, res) => {
    const data = await loadPlatformSupportConfig();
    return ApiResponse.ok(res, data);
  }),
);

/** Plan + tenant override flags — any staff user with `libraryId` (sidebar / gates). */
router.get('/effective-features', subscriptionBillingController.getEffectiveFeatures);

router.use(requireRole(ROLES.LIBRARY_OWNER));

router.get('/subscription', subscriptionBillingController.ownerSubscription);
router.get('/subscription-snapshot', subscriptionBillingController.ownerSubscription);
router.get(
  '/subscription/invoices',
  validate({ query: ownerSubscriptionInvoiceListQuerySchema }),
  subscriptionBillingController.listOwnerInvoices,
);
router.get(
  '/subscription/invoices/:invoiceId',
  validate({ params: subscriptionInvoiceIdParamsSchema }),
  subscriptionBillingController.getOwnerInvoice,
);

export { router as subscriptionBillingRoutes };
