import { Router } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { loadPlatformSupportConfig } from './platform-settings.support';
import { platformService } from './platform.service';

/** Unauthenticated platform support contacts (suspended tenant page, marketing). */
const router = Router();

router.get(
  '/support-config',
  asyncHandler(async (_req, res) => {
    const data = await loadPlatformSupportConfig();
    return ApiResponse.ok(res, data);
  }),
);

router.get(
  '/subscription-plans',
  asyncHandler(async (_req, res) => {
    const data = await platformService.listPublicPlans();
    return ApiResponse.ok(res, data);
  }),
);

export { router as platformPublicRoutes };
