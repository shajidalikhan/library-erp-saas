import { Router } from 'express';

import { PERMISSIONS } from '@constants/permissions.constants';
import { authenticate } from '@middlewares/auth.middleware';
import { requireRoleCapability } from '@middlewares/role-capability.middleware';
import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { requireSubscriptionFeature } from '@middlewares/require-subscription-feature.middleware';

import { attendanceController } from './attendance.controller';
import {
  attendanceIdParamsSchema,
  attendanceListQuerySchema,
  attendanceQrTokenBodySchema,
  attendanceBoardQuerySchema,
  attendanceSummaryQuerySchema,
  checkInBodySchema,
  checkOutBodySchema,
  manualEntryBodySchema,
  studentIdParamsSchema,
  updateAttendanceBodySchema,
} from './attendance.validation';

const router = Router();

router.use(authenticate);

router.post(
  '/attendance/check-in',
  authorizeAny(PERMISSIONS.ATTENDANCE_CHECK_IN, PERMISSIONS.ATTENDANCE_CREATE),
  requireRoleCapability('attendance', 'checkin'),
  validate({ body: checkInBodySchema }),
  attendanceController.checkIn,
);

router.post(
  '/attendance/check-out',
  authorizeAny(PERMISSIONS.ATTENDANCE_CHECK_OUT, PERMISSIONS.ATTENDANCE_CREATE),
  validate({ body: checkOutBodySchema }),
  attendanceController.checkOut,
);

router.post(
  '/attendance/qr/resolve',
  requireSubscriptionFeature('qr_attendance'),
  authorizeAny(
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.ATTENDANCE_CHECK_IN,
    PERMISSIONS.ATTENDANCE_CHECK_OUT,
  ),
  validate({ body: attendanceQrTokenBodySchema }),
  attendanceController.resolveQr,
);

router.post(
  '/attendance/qr/check-in',
  requireSubscriptionFeature('qr_attendance'),
  authorizeAny(PERMISSIONS.ATTENDANCE_CHECK_IN, PERMISSIONS.ATTENDANCE_CREATE),
  validate({ body: attendanceQrTokenBodySchema }),
  attendanceController.qrCheckIn,
);

router.post(
  '/attendance/qr/check-out',
  requireSubscriptionFeature('qr_attendance'),
  authorizeAny(PERMISSIONS.ATTENDANCE_CHECK_OUT, PERMISSIONS.ATTENDANCE_CREATE),
  validate({ body: attendanceQrTokenBodySchema }),
  attendanceController.qrCheckOut,
);

router.post(
  '/attendance/manual',
  authorize(PERMISSIONS.ATTENDANCE_CREATE),
  validate({ body: manualEntryBodySchema }),
  attendanceController.manualEntry,
);

router.get(
  '/attendance/board',
  authorize(PERMISSIONS.ATTENDANCE_READ),
  validate({ query: attendanceBoardQuerySchema }),
  attendanceController.board,
);

router.get(
  '/attendance/daily',
  authorize(PERMISSIONS.ATTENDANCE_READ),
  validate({ query: attendanceListQuerySchema }),
  attendanceController.daily,
);

router.get(
  '/attendance/active',
  authorize(PERMISSIONS.ATTENDANCE_READ),
  validate({ query: attendanceListQuerySchema }),
  attendanceController.active,
);

router.get(
  '/attendance/students/:studentId/history',
  authorize(PERMISSIONS.ATTENDANCE_READ),
  validate({ params: studentIdParamsSchema, query: attendanceListQuerySchema }),
  attendanceController.studentHistory,
);

router.get(
  '/attendance/summary',
  authorizeAny(PERMISSIONS.ATTENDANCE_SUMMARY, PERMISSIONS.ATTENDANCE_READ),
  validate({ query: attendanceSummaryQuerySchema }),
  attendanceController.summary,
);

router.patch(
  '/attendance/:attendanceId',
  authorize(PERMISSIONS.ATTENDANCE_UPDATE),
  validate({ params: attendanceIdParamsSchema, body: updateAttendanceBodySchema }),
  attendanceController.update,
);

export { router as attendanceRoutes };
