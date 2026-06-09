import type { Request, Response } from 'express';

import { Types } from 'mongoose';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiError } from '@utils/ApiError';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seat.model';

import {
  cancelSeatAssignment,
  createSeatAssignment,
  updateSeatAssignment,
} from './seat-assignment.service';
import { seatOccupancyService } from './seat-occupancy.service';
import type { ShiftAssignmentStatus } from '@modules/shifts/shift.constants';

import type {
  CreateSeatAssignmentInput,
  UpdateSeatAssignmentInput,
} from './seat-assignment.validation';

class SeatAssignmentController {
  getGrid = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as { branchId: string; floor?: string; zone?: string };
    const grid = await seatOccupancyService.getGrid(user, query);
    return ApiResponse.ok(res, grid, 'Seat occupancy grid');
  });

  getSeatOccupancy = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { seatId } = (req.validatedParams ?? req.params) as { seatId: string };
    const data = await seatOccupancyService.getSeatOccupancy(user, seatId);
    return ApiResponse.ok(res, data, 'Seat occupancy');
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CreateSeatAssignmentInput;

    const [seat, student] = await Promise.all([
      SeatModel.findById(body.seatId),
      StudentModel.findById(body.studentId),
    ]);
    if (!seat) throw ApiError.notFound('Seat not found');
    if (!student) throw ApiError.notFound('Student not found');

    const startDate = body.startDate ?? (student.membershipStartDate ? new Date(student.membershipStartDate) : new Date());
    const endDate =
      body.endDate !== undefined
        ? body.endDate
        : student.membershipEndDate
          ? new Date(student.membershipEndDate)
          : null;

    const assignment = await createSeatAssignment({
      user,
      seat,
      studentId: student._id as Types.ObjectId,
      shiftId: new Types.ObjectId(body.shiftId),
      startDate,
      endDate,
      membershipId: body.membershipId ? new Types.ObjectId(body.membershipId) : null,
      status: body.status,
    });

    return ApiResponse.created(res, { assignment }, 'Seat assigned');
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { assignmentId } = (req.validatedParams ?? req.params) as { assignmentId: string };
    const body = (req.validatedBody ?? req.body) as UpdateSeatAssignmentInput;
    const assignment = await updateSeatAssignment(user, assignmentId, {
      ...body,
      status: body.status as ShiftAssignmentStatus | undefined,
    });
    return ApiResponse.ok(res, { assignment }, 'Assignment updated');
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { assignmentId } = (req.validatedParams ?? req.params) as { assignmentId: string };
    const assignment = await cancelSeatAssignment(user, assignmentId);
    return ApiResponse.ok(res, { assignment }, 'Assignment cancelled');
  });
}

export const seatAssignmentController = new SeatAssignmentController();
