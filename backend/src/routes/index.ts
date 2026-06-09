import { Router } from 'express';
import { authRoutes } from '@modules/auth/auth.routes';
import { libraryRoutes } from '@modules/library/library.routes';
import { studentRoutes } from '@modules/students/student.routes';
import { seatRoutes } from '@modules/seats/seat.routes';
import { seatAssignmentRoutes } from '@modules/seats/seat-assignment.routes';
import { attendanceRoutes } from '@modules/attendance/attendance.routes';
import { paymentRoutes } from '@modules/payments/payment.routes';
import { analyticsRoutes } from '@modules/analytics';
import { reportsRoutes } from '@modules/reports';
import { userRoutes } from '@modules/users';
import { notificationsRoutes } from '@modules/notifications';
import { platformRoutes } from '@modules/platform';
import { platformPublicRoutes } from '@modules/platform/platform-public.routes';
import { demoRequestRoutes } from '@modules/demo-requests';
import { activityRoutes } from '@modules/activity';
import { searchRoutes } from '@modules/search';
import { settingsRoutes } from '@modules/settings';
import { shiftRoutes } from '@modules/shifts';
import { membershipRoutes } from '@modules/membership/membership.routes';
import { uploadRoutes } from '@modules/uploads/upload.routes';
import { subscriptionBillingRoutes } from '@modules/subscription-billing/subscription-billing.billing.routes';
import { publicBookingRoutes } from '@modules/bookings';

/**
 * Aggregator for all module routers.
 * Add new module routes here as the codebase grows.
 */
const router = Router();

router.use('/auth', authRoutes);
/** Public visitor booking — mount before any router that uses `router.use(authenticate)` at `/`. */
router.use(publicBookingRoutes);
router.use(uploadRoutes);
router.use('/settings', settingsRoutes);
router.use('/shifts', shiftRoutes);
router.use('/memberships', membershipRoutes);
router.use('/demo-requests', demoRequestRoutes);
router.use('/public/platform', platformPublicRoutes);
router.use('/platform', platformRoutes);
router.use('/billing', subscriptionBillingRoutes);
router.use(libraryRoutes);
router.use(studentRoutes);
router.use(seatAssignmentRoutes);
router.use(seatRoutes);
router.use(attendanceRoutes);
router.use(paymentRoutes);
router.use(analyticsRoutes);
router.use('/reports', reportsRoutes);
router.use(userRoutes);
router.use(notificationsRoutes);
router.use(activityRoutes);
router.use(searchRoutes);

export { router as apiRouter };
