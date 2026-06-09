import { Router } from 'express';

import { PERMISSIONS } from '@constants/permissions.constants';
import { authenticate } from '@middlewares/auth.middleware';
import { publicRateLimiter } from '@middlewares/rateLimit.middleware';
import { authorizeAny } from '@middlewares/rbac.middleware';
import { requireRoleCapability } from '@middlewares/role-capability.middleware';
import { requireSubscriptionFeature } from '@middlewares/require-subscription-feature.middleware';
import { validate } from '@middlewares/validate.middleware';

import { publicBookingController } from './public-booking.controller';
import {
  bookingPrefillParamsSchema,
  bookingIdParamsSchema,
  createPublicBookingBodySchema,
  listBookingsQuerySchema,
  publicAvailabilityQuerySchema,
  publicSlugParamsSchema,
  rejectBookingBodySchema,
  releasePublicHoldBodySchema,
} from './public-booking.validation';

const router = Router();

router.get(
  '/public/libraries/:slug',
  publicRateLimiter,
  validate({ params: publicSlugParamsSchema }),
  publicBookingController.getLibraryProfile,
);

router.get(
  '/public/libraries/:slug/availability',
  publicRateLimiter,
  validate({ params: publicSlugParamsSchema, query: publicAvailabilityQuerySchema }),
  publicBookingController.getAvailability,
);

router.post(
  '/public/libraries/:slug/bookings',
  publicRateLimiter,
  validate({ params: publicSlugParamsSchema, body: createPublicBookingBodySchema }),
  publicBookingController.createBooking,
);

router.use(authenticate);
router.use(requireSubscriptionFeature('public_booking'));

router.get(
  '/bookings',
  authorizeAny(
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.PUBLIC_PAGE_MANAGE,
  ),
  requireRoleCapability('public_booking', 'view'),
  validate({ query: listBookingsQuerySchema }),
  publicBookingController.listOwnerBookings,
);

router.get(
  '/bookings/:bookingId',
  authorizeAny(
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.PUBLIC_PAGE_MANAGE,
  ),
  requireRoleCapability('public_booking', 'view'),
  validate({ params: bookingIdParamsSchema }),
  publicBookingController.getOwnerBooking,
);

router.get(
  '/bookings/:bookingId/admission-prefill',
  authorizeAny(PERMISSIONS.BOOKING_READ, PERMISSIONS.BOOKING_UPDATE, PERMISSIONS.BOOKING_CONVERT),
  requireRoleCapability('public_booking', 'view'),
  validate({ params: bookingPrefillParamsSchema }),
  publicBookingController.getAdmissionPrefill,
);

router.post(
  '/bookings/:bookingId/approve',
  authorizeAny(PERMISSIONS.BOOKING_UPDATE, PERMISSIONS.BOOKING_MANAGE),
  requireRoleCapability('public_booking', 'approve', PERMISSIONS.BOOKING_UPDATE),
  validate({ params: bookingIdParamsSchema }),
  publicBookingController.approveBooking,
);

router.post(
  '/bookings/:bookingId/reject',
  authorizeAny(PERMISSIONS.BOOKING_UPDATE, PERMISSIONS.BOOKING_MANAGE),
  requireRoleCapability('public_booking', 'approve', PERMISSIONS.BOOKING_UPDATE),
  validate({ params: bookingIdParamsSchema, body: rejectBookingBodySchema }),
  publicBookingController.rejectBooking,
);

router.post(
  '/bookings/:bookingId/release-hold',
  authorizeAny(
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.BOOKING_UPDATE,
    PERMISSIONS.SEAT_ASSIGN,
  ),
  requireRoleCapability('public_booking', 'manage', PERMISSIONS.BOOKING_MANAGE),
  validate({ params: bookingIdParamsSchema, body: releasePublicHoldBodySchema }),
  publicBookingController.releaseHoldByStaff,
);

router.post(
  '/bookings/:bookingId/convert-to-student',
  authorizeAny(PERMISSIONS.BOOKING_CONVERT, PERMISSIONS.BOOKING_MANAGE),
  requireRoleCapability('public_booking', 'convert', PERMISSIONS.BOOKING_CONVERT),
  validate({ params: bookingIdParamsSchema }),
  publicBookingController.convertToStudent,
);

export { router as publicBookingRoutes };
