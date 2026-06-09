import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { activityService } from './activity.service';
import type { RecentActivityQuery } from './activity.validation';

class ActivityController {
  recent = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as RecentActivityQuery;
    const { items, meta } = await activityService.listRecent(user, query);
    return ApiResponse.ok(res, { items }, 'Recent activity', meta);
  });
}

export const activityController = new ActivityController();
