import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { seatService } from './seat.service';
import type {
  AssignSeatInput,
  BulkCreateSeatsInput,
  CreateSeatInput,
  ListSeatsQuery,
  OccupancySummaryQuery,
  UpdateSeatInput,
} from './seat.validation';

class SeatController {
  listSeats = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ListSeatsQuery;
    const { items, meta } = await seatService.listSeats(user, query);
    return ApiResponse.ok(res, { items }, 'Seats retrieved', meta);
  });

  listAvailable = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ListSeatsQuery;
    const { items, meta } = await seatService.listAvailableSeats(user, query);
    return ApiResponse.ok(res, { items }, 'Available seats retrieved', meta);
  });

  listReserved = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ListSeatsQuery;
    const { items, meta } = await seatService.listReservedSeats(user, query);
    return ApiResponse.ok(res, { items }, 'Reserved seats retrieved', meta);
  });

  occupancySummary = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as OccupancySummaryQuery;
    const summary = await seatService.occupancySummary(user, query);
    return ApiResponse.ok(res, summary, 'Occupancy summary');
  });

  createSeat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CreateSeatInput;
    const seat = await seatService.createSeat(user, body);
    return ApiResponse.created(res, { seat }, 'Seat created');
  });

  bulkCreate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as BulkCreateSeatsInput;
    const result = await seatService.bulkCreateSeats(user, body);
    return ApiResponse.created(res, result, 'Bulk seats created');
  });

  getSeat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { seatId } = (req.validatedParams ?? req.params) as { seatId: string };
    const seat = await seatService.getSeatById(user, seatId);
    return ApiResponse.ok(res, { seat }, 'Seat retrieved');
  });

  updateSeat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { seatId } = (req.validatedParams ?? req.params) as { seatId: string };
    const body = (req.validatedBody ?? req.body) as UpdateSeatInput;
    const seat = await seatService.updateSeat(user, seatId, body);
    return ApiResponse.ok(res, { seat }, 'Seat updated');
  });

  deleteSeat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { seatId } = (req.validatedParams ?? req.params) as { seatId: string };
    const result = await seatService.deleteSeat(user, seatId);
    return ApiResponse.ok(res, result, 'Seat deleted');
  });

  assignSeat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { seatId } = (req.validatedParams ?? req.params) as { seatId: string };
    const body = (req.validatedBody ?? req.body) as AssignSeatInput;
    const seat = await seatService.assignSeatToStudent(user, seatId, body);
    return ApiResponse.ok(res, { seat }, 'Seat assigned');
  });

  unassignSeat = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { seatId } = (req.validatedParams ?? req.params) as { seatId: string };
    const seat = await seatService.unassignSeat(user, seatId);
    return ApiResponse.ok(res, { seat }, 'Seat unassigned');
  });
}

export const seatController = new SeatController();
