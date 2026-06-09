import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { ApiError } from '@utils/ApiError';
import type { AuthenticatedUser } from '@/types/express';

import { demoRequestService } from './demo-request.service';
import type {
  CreateDemoRequestInput,
  DemoRequestsListQuery,
  PatchDemoRequestInput,
} from './demo-request.validation';

const requireAuthUser = (user: AuthenticatedUser | undefined): AuthenticatedUser => {
  if (!user) throw ApiError.unauthorized('Authentication required');
  return user;
};

class DemoRequestController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.validatedBody ?? req.body) as CreateDemoRequestInput;
    const data = await demoRequestService.createPublic(body);
    return ApiResponse.created(res, data, 'Thanks! Our team will contact you shortly.');
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = req.validatedQuery as DemoRequestsListQuery;
    const data = await demoRequestService.listForPlatform(user, query);
    return ApiResponse.ok(res, data);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { requestId } = req.validatedParams as { requestId: string };
    const data = await demoRequestService.getForPlatform(user, requestId);
    return ApiResponse.ok(res, data);
  });

  patch = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { requestId } = req.validatedParams as { requestId: string };
    const body = req.validatedBody as PatchDemoRequestInput;
    const data = await demoRequestService.patchForPlatform(user, requestId, body);
    return ApiResponse.ok(res, data, 'Demo request updated');
  });
}

export const demoRequestController = new DemoRequestController();
