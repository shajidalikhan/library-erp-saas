import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { ApiError } from '@utils/ApiError';

import { shiftService } from './shift.service';
import type { CreateShiftInput, ListShiftsQuery, UpdateShiftInput } from './shift.validation';

class ShiftController {
  list = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const query = (req.validatedQuery ?? req.query) as ListShiftsQuery;
    const items = await shiftService.list(req.user, query);
    return ApiResponse.ok(res, { items }, 'Shifts loaded');
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await shiftService.getById(req.user, String(req.params.shiftId));
    return ApiResponse.ok(res, { shift: data }, 'Shift loaded');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validatedBody as CreateShiftInput;
    const shift = await shiftService.create(req.user, body);
    return ApiResponse.created(res, { shift }, 'Shift created');
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validatedBody as UpdateShiftInput;
    const shift = await shiftService.update(req.user, String(req.params.shiftId), body);
    return ApiResponse.ok(res, { shift }, 'Shift updated');
  });

  deactivate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const shift = await shiftService.deactivate(req.user, String(req.params.shiftId));
    return ApiResponse.ok(res, { shift }, 'Shift deactivated');
  });
}

export const shiftController = new ShiftController();
