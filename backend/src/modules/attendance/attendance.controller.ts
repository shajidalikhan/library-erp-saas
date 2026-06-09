import type { Request, Response } from 'express';

import { requireAuthUser } from '@middlewares/auth.middleware';
import { ApiResponse } from '@utils/ApiResponse';
import { asyncHandler } from '@utils/asyncHandler';

import { attendanceBoardService } from './attendance-board.service';
import { attendanceService } from './attendance.service';
import type {
  AttendanceBoardQuery,
  AttendanceListQuery,
  AttendanceQrTokenInput,
  AttendanceSummaryQuery,
  CheckInInput,
  CheckOutInput,
  ManualEntryInput,
  UpdateAttendanceInput,
} from './attendance.validation';

class AttendanceController {
  checkIn = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CheckInInput;
    const attendance = await attendanceService.checkInStudent(user, body);
    return ApiResponse.created(res, { attendance }, 'Student checked in');
  });

  checkOut = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as CheckOutInput;
    const attendance = await attendanceService.checkOutStudent(user, body);
    return ApiResponse.ok(res, { attendance }, 'Student checked out');
  });

  manualEntry = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = (req.validatedBody ?? req.body) as ManualEntryInput;
    const attendance = await attendanceService.manualEntry(user, body);
    return ApiResponse.created(res, { attendance }, 'Manual attendance entry created');
  });

  board = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AttendanceBoardQuery;
    const board = await attendanceBoardService.getBoard(user, query);
    return ApiResponse.ok(res, board, 'Attendance board retrieved');
  });

  daily = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AttendanceListQuery;
    const { items, meta } = await attendanceService.listDaily(user, query);
    return ApiResponse.ok(res, { items }, 'Daily attendance retrieved', meta);
  });

  studentHistory = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AttendanceListQuery;
    const { studentId } = (req.validatedParams ?? req.params) as { studentId: string };
    const { items, meta } = await attendanceService.getStudentHistory(user, studentId, query);
    return ApiResponse.ok(res, { items }, 'Student attendance history retrieved', meta);
  });

  active = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AttendanceListQuery;
    const { items, meta } = await attendanceService.getActiveCheckIns(user, query);
    return ApiResponse.ok(res, { items }, 'Active check-ins retrieved', meta);
  });

  summary = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AttendanceSummaryQuery;
    const summary = await attendanceService.getSummary(user, query);
    return ApiResponse.ok(res, summary, 'Attendance summary retrieved');
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { attendanceId } = (req.validatedParams ?? req.params) as { attendanceId: string };
    const body = (req.validatedBody ?? req.body) as UpdateAttendanceInput;
    const attendance = await attendanceService.updateAttendance(user, attendanceId, body);
    return ApiResponse.ok(res, { attendance }, 'Attendance updated');
  });

  resolveQr = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { qrToken } = (req.validatedBody ?? req.body) as AttendanceQrTokenInput;
    const preview = await attendanceService.resolveAttendanceQr(user, qrToken);
    return ApiResponse.ok(res, preview, 'QR resolved');
  });

  qrCheckIn = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { qrToken } = (req.validatedBody ?? req.body) as AttendanceQrTokenInput;
    const attendance = await attendanceService.qrCheckInStudent(user, qrToken);
    return ApiResponse.created(res, { attendance }, 'Student checked in');
  });

  qrCheckOut = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { qrToken } = (req.validatedBody ?? req.body) as AttendanceQrTokenInput;
    const attendance = await attendanceService.qrCheckOutStudent(user, qrToken);
    return ApiResponse.ok(res, { attendance }, 'Student checked out');
  });
}

export const attendanceController = new AttendanceController();
