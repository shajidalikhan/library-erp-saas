import { Router } from 'express';

import { authenticate } from '@middlewares/auth.middleware';
import { authorize } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { PERMISSIONS } from '@constants/permissions.constants';

import { shiftController } from './shift.controller';
import { createShiftSchema, listShiftsQuerySchema, updateShiftSchema } from './shift.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  authorize(PERMISSIONS.SHIFT_READ),
  validate({ query: listShiftsQuerySchema }),
  shiftController.list,
);

router.get(
  '/:shiftId',
  authorize(PERMISSIONS.SHIFT_READ),
  shiftController.getById,
);

router.post(
  '/',
  authorize(PERMISSIONS.SHIFT_CREATE),
  validate({ body: createShiftSchema }),
  shiftController.create,
);

router.patch(
  '/:shiftId',
  authorize(PERMISSIONS.SHIFT_UPDATE),
  validate({ body: updateShiftSchema }),
  shiftController.update,
);

router.delete(
  '/:shiftId',
  authorize(PERMISSIONS.SHIFT_DELETE),
  shiftController.deactivate,
);

export { router as shiftRoutes };
