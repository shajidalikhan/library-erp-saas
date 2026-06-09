import { Router } from 'express';

import { authenticate } from '@middlewares/auth.middleware';
import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { PERMISSIONS } from '@constants/permissions.constants';

import { seatAssignmentController } from './seat-assignment.controller';
import { seatIdParamsSchema } from './seat.validation';
import {
  createSeatAssignmentSchema,
  seatAssignmentIdParamsSchema,
  seatGridQuerySchema,
  updateSeatAssignmentSchema,
} from './seat-assignment.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/seats/grid',
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  validate({ query: seatGridQuerySchema }),
  seatAssignmentController.getGrid,
);

router.get(
  '/seats/:seatId/occupancy',
  authorizeAny(PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ),
  validate({ params: seatIdParamsSchema }),
  seatAssignmentController.getSeatOccupancy,
);

router.post(
  '/seat-assignments',
  authorize(PERMISSIONS.SEAT_ASSIGN),
  validate({ body: createSeatAssignmentSchema }),
  seatAssignmentController.create,
);

router.patch(
  '/seat-assignments/:assignmentId',
  authorize(PERMISSIONS.SEAT_ASSIGN),
  validate({ params: seatAssignmentIdParamsSchema, body: updateSeatAssignmentSchema }),
  seatAssignmentController.update,
);

router.delete(
  '/seat-assignments/:assignmentId',
  authorizeAny(PERMISSIONS.SEAT_ASSIGN, PERMISSIONS.SEAT_UNASSIGN),
  validate({ params: seatAssignmentIdParamsSchema }),
  seatAssignmentController.remove,
);

export { router as seatAssignmentRoutes };
