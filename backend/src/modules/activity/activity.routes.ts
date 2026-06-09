import { Router } from 'express';

import { authenticate } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validate.middleware';

import { activityController } from './activity.controller';
import { recentActivityQuerySchema } from './activity.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/activity/recent',
  validate({ query: recentActivityQuerySchema }),
  activityController.recent,
);

router.get(
  '/dashboard/recent-activity',
  validate({ query: recentActivityQuerySchema }),
  activityController.recent,
);

export { router as activityRoutes };
