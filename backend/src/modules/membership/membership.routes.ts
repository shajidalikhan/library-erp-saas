import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';

import { authenticate } from '@middlewares/auth.middleware';
import { authorize } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { PERMISSIONS } from '@constants/permissions.constants';
import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { ApiError } from '@utils/ApiError';

import { membershipService } from './membership.service';

const objectId = z.string().refine((id) => Types.ObjectId.isValid(id));

const dashboardQuerySchema = z.object({
  libraryId: objectId.optional(),
  branchId: objectId.optional(),
});

const renewSchema = z.object({
  feePlanId: objectId,
  durationDays: z.coerce.number().int().positive().optional(),
  membershipType: z.string().optional(),
});

const router = Router();
router.use(authenticate);

router.get(
  '/dashboard',
  authorize(PERMISSIONS.MEMBERSHIP_READ),
  validate({ query: dashboardQuerySchema }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const stats = await membershipService.getDashboardStats(req.user, req.validatedQuery as {
      libraryId?: string;
      branchId?: string;
    });
    return ApiResponse.ok(res, stats, 'Membership dashboard');
  }),
);

router.get(
  '/student/:studentId',
  authorize(PERMISSIONS.MEMBERSHIP_READ),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const items = await membershipService.listForStudent(req.user, String(req.params.studentId));
    return ApiResponse.ok(res, { items }, 'Membership history');
  }),
);

router.post(
  '/student/:studentId/renew',
  authorize(PERMISSIONS.MEMBERSHIP_RENEW),
  validate({ body: renewSchema }),
  asyncHandler(async (req, res) => {
    if (!req.user) throw ApiError.unauthorized();
    const membership = await membershipService.renew(
      req.user,
      String(req.params.studentId),
      req.validatedBody as z.infer<typeof renewSchema>,
    );
    return ApiResponse.ok(res, { membership }, 'Membership renewed');
  }),
);

export { router as membershipRoutes };
