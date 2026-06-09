import { Router } from 'express';

import { PERMISSIONS } from '@constants/permissions.constants';
import { authenticate } from '@middlewares/auth.middleware';
import { requireRoleCapability } from '@middlewares/role-capability.middleware';
import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';

import { paymentController } from './payment.controller';
import {
  collectPaymentBodySchema,
  createFeePlanBodySchema,
  createInvoiceBodySchema,
  feePlanIdParamsSchema,
  feePlanListQuerySchema,
  invoiceIdParamsSchema,
  invoiceListQuerySchema,
  paginationQuerySchema,
  paymentIdParamsSchema,
  paymentListQuerySchema,
  paymentSummaryQuerySchema,
  refundBodySchema,
  studentHistoryParamsSchema,
  updateFeePlanBodySchema,
  updateInvoiceBodySchema,
} from './payment.validation';

const router = Router();

router.use(authenticate);

/** Fee plans */
router.post(
  '/payments/fee-plans',
  authorize(PERMISSIONS.FEE_PLAN_CREATE),
  validate({ body: createFeePlanBodySchema }),
  paymentController.createFeePlan,
);

router.get(
  '/payments/fee-plans',
  authorizeAny(
    PERMISSIONS.FEE_PLAN_READ,
    PERMISSIONS.PAYMENT_READ,
    PERMISSIONS.PAYMENT_CREATE,
  ),
  validate({ query: feePlanListQuerySchema }),
  paymentController.listFeePlans,
);

router.patch(
  '/payments/fee-plans/:feePlanId',
  authorize(PERMISSIONS.FEE_PLAN_UPDATE),
  validate({ params: feePlanIdParamsSchema, body: updateFeePlanBodySchema }),
  paymentController.updateFeePlan,
);

router.delete(
  '/payments/fee-plans/:feePlanId',
  authorize(PERMISSIONS.FEE_PLAN_DELETE),
  validate({ params: feePlanIdParamsSchema }),
  paymentController.deleteFeePlan,
);

/** Invoices */
router.post(
  '/payments/invoices',
  authorize(PERMISSIONS.PAYMENT_CREATE),
  requireRoleCapability('payments', 'collect', PERMISSIONS.PAYMENT_CREATE),
  validate({ body: createInvoiceBodySchema }),
  paymentController.createInvoice,
);

router.get(
  '/payments/invoices',
  authorize(PERMISSIONS.PAYMENT_READ),
  validate({ query: invoiceListQuerySchema }),
  paymentController.listInvoices,
);

router.get(
  '/payments/invoices/dues',
  authorize(PERMISSIONS.PAYMENT_READ),
  validate({ query: invoiceListQuerySchema }),
  paymentController.listDues,
);

router.get(
  '/payments/invoices/overdue',
  authorize(PERMISSIONS.PAYMENT_READ),
  validate({ query: invoiceListQuerySchema }),
  paymentController.listOverdue,
);

router.get(
  '/payments/invoices/:invoiceId',
  authorize(PERMISSIONS.PAYMENT_READ),
  validate({ params: invoiceIdParamsSchema }),
  paymentController.getInvoice,
);

router.patch(
  '/payments/invoices/:invoiceId',
  authorize(PERMISSIONS.PAYMENT_UPDATE),
  validate({ params: invoiceIdParamsSchema, body: updateInvoiceBodySchema }),
  paymentController.updateInvoice,
);

/** Payments & receipts */
router.post(
  '/payments/collect',
  authorize(PERMISSIONS.PAYMENT_CREATE),
  requireRoleCapability('payments', 'collect', PERMISSIONS.PAYMENT_CREATE),
  validate({ body: collectPaymentBodySchema }),
  paymentController.collectPayment,
);

router.get(
  '/payments/payments',
  authorize(PERMISSIONS.PAYMENT_READ),
  validate({ query: paymentListQuerySchema }),
  paymentController.listPayments,
);

router.get(
  '/payments/receipts/:paymentId',
  authorize(PERMISSIONS.PAYMENT_READ),
  validate({ params: paymentIdParamsSchema }),
  paymentController.getReceipt,
);

router.post(
  '/payments/refunds',
  authorize(PERMISSIONS.PAYMENT_REFUND),
  validate({ body: refundBodySchema }),
  paymentController.refundPayment,
);

router.delete(
  '/payments/payments/:paymentId',
  authorize(PERMISSIONS.PAYMENT_DELETE),
  validate({ params: paymentIdParamsSchema }),
  paymentController.voidPayment,
);

router.get(
  '/payments/students/:studentId/history',
  authorize(PERMISSIONS.PAYMENT_READ),
  validate({ params: studentHistoryParamsSchema, query: paginationQuerySchema }),
  paymentController.studentHistory,
);

router.get(
  '/payments/summary',
  authorize(PERMISSIONS.PAYMENT_SUMMARY),
  validate({ query: paymentSummaryQuerySchema }),
  paymentController.summary,
);

export { router as paymentRoutes };
