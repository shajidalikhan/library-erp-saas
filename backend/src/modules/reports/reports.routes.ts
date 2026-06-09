import { Router } from 'express';

import { PERMISSIONS } from '@constants/permissions.constants';
import { authenticate } from '@middlewares/auth.middleware';
import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { requireSubscriptionFeature } from '@middlewares/require-subscription-feature.middleware';

import { reportsController } from './reports.controller';
import { reportExportQuerySchema, reportListQuerySchema } from './reports.validation';

const router = Router();

router.use(authenticate);

const reportGate = authorizeAny(PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW);
const reportsFeature = requireSubscriptionFeature('reports');
const exportsFeature = requireSubscriptionFeature('exports');
const listValidate = validate({ query: reportListQuerySchema });
const exportValidate = validate({ query: reportExportQuerySchema });

router.get(
  '/students',
  reportGate,
  reportsFeature,
  authorize(PERMISSIONS.STUDENT_READ),
  listValidate,
  reportsController.students,
);
router.get(
  '/students/export',
  reportGate,
  exportsFeature,
  authorize(PERMISSIONS.STUDENT_READ),
  exportValidate,
  reportsController.exportStudents,
);

router.get(
  '/attendance',
  reportGate,
  reportsFeature,
  authorize(PERMISSIONS.ATTENDANCE_READ),
  listValidate,
  reportsController.attendance,
);
router.get(
  '/attendance/export',
  reportGate,
  exportsFeature,
  authorize(PERMISSIONS.ATTENDANCE_READ),
  exportValidate,
  reportsController.exportAttendance,
);

router.get('/payments', reportGate, reportsFeature, authorize(PERMISSIONS.PAYMENT_READ), listValidate, reportsController.payments);
router.get(
  '/payments/export',
  reportGate,
  exportsFeature,
  authorize(PERMISSIONS.PAYMENT_READ),
  exportValidate,
  reportsController.exportPayments,
);

router.get('/invoices', reportGate, reportsFeature, authorize(PERMISSIONS.PAYMENT_READ), listValidate, reportsController.invoices);
router.get(
  '/invoices/export',
  reportGate,
  exportsFeature,
  authorize(PERMISSIONS.PAYMENT_READ),
  exportValidate,
  reportsController.exportInvoices,
);

router.get(
  '/seats',
  reportGate,
  reportsFeature,
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  listValidate,
  reportsController.seats,
);
router.get(
  '/seats/export',
  reportGate,
  exportsFeature,
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  exportValidate,
  reportsController.exportSeats,
);

router.get('/dues', reportGate, reportsFeature, authorize(PERMISSIONS.PAYMENT_READ), listValidate, reportsController.dues);
router.get(
  '/dues/export',
  reportGate,
  exportsFeature,
  authorize(PERMISSIONS.PAYMENT_READ),
  exportValidate,
  reportsController.exportDues,
);

router.get(
  '/branches',
  reportGate,
  reportsFeature,
  authorizeAny(PERMISSIONS.BRANCH_READ, PERMISSIONS.PAYMENT_READ),
  listValidate,
  reportsController.branches,
);

router.get(
  '/collections/daily',
  reportGate,
  reportsFeature,
  authorize(PERMISSIONS.PAYMENT_READ),
  listValidate,
  reportsController.collectionsDaily,
);
router.get(
  '/collections/monthly',
  reportGate,
  reportsFeature,
  authorize(PERMISSIONS.PAYMENT_READ),
  listValidate,
  reportsController.collectionsMonthly,
);

export { router as reportsRoutes };
