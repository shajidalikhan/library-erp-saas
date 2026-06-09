import { Router } from 'express';

import { authenticate } from '@middlewares/auth.middleware';
import { requireRoleCapability } from '@middlewares/role-capability.middleware';
import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { PERMISSIONS } from '@constants/permissions.constants';

import { seatController } from './seat.controller';
import {
  assignSeatBodySchema,
  bulkCreateSeatsBodySchema,
  createSeatBodySchema,
  listSeatsQuerySchema,
  occupancySummaryQuerySchema,
  seatIdParamsSchema,
  updateSeatBodySchema,
} from './seat.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/seats/occupancy/summary',
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  validate({ query: occupancySummaryQuerySchema }),
  seatController.occupancySummary,
);

router.get(
  '/seats/available',
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  validate({ query: listSeatsQuerySchema }),
  seatController.listAvailable,
);

router.get(
  '/seats/reserved',
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  validate({ query: listSeatsQuerySchema }),
  seatController.listReserved,
);

router.post(
  '/seats/bulk',
  authorize(PERMISSIONS.SEAT_BULK_CREATE),
  validate({ body: bulkCreateSeatsBodySchema }),
  seatController.bulkCreate,
);

router.get(
  '/seats',
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  requireRoleCapability('seats', 'view'),
  validate({ query: listSeatsQuerySchema }),
  seatController.listSeats,
);

router.post(
  '/seats',
  authorize(PERMISSIONS.SEAT_CREATE),
  validate({ body: createSeatBodySchema }),
  seatController.createSeat,
);

router.get(
  '/seats/:seatId',
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  validate({ params: seatIdParamsSchema }),
  seatController.getSeat,
);

router.patch(
  '/seats/:seatId',
  authorize(PERMISSIONS.SEAT_UPDATE),
  validate({ params: seatIdParamsSchema, body: updateSeatBodySchema }),
  seatController.updateSeat,
);

router.delete(
  '/seats/:seatId',
  authorize(PERMISSIONS.SEAT_DELETE),
  validate({ params: seatIdParamsSchema }),
  seatController.deleteSeat,
);

router.post(
  '/seats/:seatId/assign',
  authorize(PERMISSIONS.SEAT_ASSIGN),
  validate({ params: seatIdParamsSchema, body: assignSeatBodySchema }),
  seatController.assignSeat,
);

router.post(
  '/seats/:seatId/unassign',
  authorize(PERMISSIONS.SEAT_UNASSIGN),
  validate({ params: seatIdParamsSchema }),
  seatController.unassignSeat,
);

export { router as seatRoutes };
