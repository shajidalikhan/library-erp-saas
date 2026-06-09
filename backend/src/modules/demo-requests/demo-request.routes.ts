import { Router } from 'express';

import { authRateLimiter } from '@middlewares/rateLimit.middleware';
import { validate } from '@middlewares/validate.middleware';

import { demoRequestController } from './demo-request.controller';
import { createDemoRequestSchema } from './demo-request.validation';

const router = Router();

router.post(
  '/',
  authRateLimiter,
  validate({ body: createDemoRequestSchema }),
  demoRequestController.create,
);

export { router as demoRequestRoutes };
