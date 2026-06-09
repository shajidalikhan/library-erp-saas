import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { reportsService } from './reports.service';
import type { ReportExportQuery, ReportListQuery } from './reports.validation';
import { sendExportBinaryResponse } from './reports-export.util';

class ReportsController {
  students = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listStudents(user, query);
    return ApiResponse.ok(res, data, 'Student report');
  });

  attendance = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listAttendance(user, query);
    return ApiResponse.ok(res, data, 'Attendance report');
  });

  payments = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listPayments(user, query);
    return ApiResponse.ok(res, data, 'Payment report');
  });

  invoices = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listInvoices(user, query);
    return ApiResponse.ok(res, data, 'Invoice report');
  });

  seats = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listSeats(user, query);
    return ApiResponse.ok(res, data, 'Seat report');
  });

  dues = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listDues(user, query);
    return ApiResponse.ok(res, data, 'Dues report');
  });

  branches = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listBranches(user, query);
    return ApiResponse.ok(res, data, 'Branch report');
  });

  collectionsDaily = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listCollectionsDaily(user, query);
    return ApiResponse.ok(res, data, 'Daily collection');
  });

  collectionsMonthly = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportListQuery;
    const data = await reportsService.listCollectionsMonthly(user, query);
    return ApiResponse.ok(res, data, 'Monthly collection');
  });

  exportStudents = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportExportQuery;
    const { body, filePrefix, format } = await reportsService.exportStudents(user, query);
    sendExportBinaryResponse(res, body, filePrefix, format);
  });

  exportAttendance = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportExportQuery;
    const { body, filePrefix, format } = await reportsService.exportAttendance(user, query);
    sendExportBinaryResponse(res, body, filePrefix, format);
  });

  exportPayments = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportExportQuery;
    const { body, filePrefix, format } = await reportsService.exportPayments(user, query);
    sendExportBinaryResponse(res, body, filePrefix, format);
  });

  exportInvoices = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportExportQuery;
    const { body, filePrefix, format } = await reportsService.exportInvoices(user, query);
    sendExportBinaryResponse(res, body, filePrefix, format);
  });

  exportSeats = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportExportQuery;
    const { body, filePrefix, format } = await reportsService.exportSeats(user, query);
    sendExportBinaryResponse(res, body, filePrefix, format);
  });

  exportDues = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as ReportExportQuery;
    const { body, filePrefix, format } = await reportsService.exportDues(user, query);
    sendExportBinaryResponse(res, body, filePrefix, format);
  });
}

export const reportsController = new ReportsController();
