import { Router } from 'express';

import { PERMISSIONS } from '@constants/permissions.constants';
import { authenticate } from '@middlewares/auth.middleware';
import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { requireSubscriptionFeature } from '@middlewares/require-subscription-feature.middleware';

import { analyticsController } from './analytics.controller';
import { analyticsQuerySchema } from './analytics.validation';

const router = Router();

router.use(authenticate);

const scopeValidate = validate({ query: analyticsQuerySchema });
const analyticsGate = authorizeAny(PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW);
const analyticsFeature = requireSubscriptionFeature('analytics');

router.use(analyticsFeature);

router.get('/analytics/overview', analyticsGate, scopeValidate, analyticsController.overview);
router.get(
  '/analytics/students',
  analyticsGate,
  authorize(PERMISSIONS.STUDENT_READ),
  scopeValidate,
  analyticsController.students,
);
router.get(
  '/analytics/seats',
  analyticsGate,
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  scopeValidate,
  analyticsController.seats,
);
router.get(
  '/analytics/attendance',
  analyticsGate,
  authorize(PERMISSIONS.ATTENDANCE_READ),
  scopeValidate,
  analyticsController.attendance,
);
router.get(
  '/analytics/revenue',
  analyticsGate,
  authorize(PERMISSIONS.PAYMENT_READ),
  scopeValidate,
  analyticsController.revenue,
);
router.get(
  '/analytics/payments',
  analyticsGate,
  authorize(PERMISSIONS.PAYMENT_READ),
  scopeValidate,
  analyticsController.payments,
);
router.get(
  '/analytics/branches',
  analyticsGate,
  authorize(PERMISSIONS.PAYMENT_READ),
  scopeValidate,
  analyticsController.branches,
);
router.get(
  '/analytics/trends/daily',
  analyticsGate,
  authorize(PERMISSIONS.PAYMENT_READ),
  scopeValidate,
  analyticsController.trendsDaily,
);
router.get(
  '/analytics/trends/monthly',
  analyticsGate,
  authorize(PERMISSIONS.PAYMENT_READ),
  scopeValidate,
  analyticsController.trendsMonthly,
);

export { router as analyticsRoutes };
