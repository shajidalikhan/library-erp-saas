import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { analyticsService } from './analytics.service';
import type { AnalyticsQuery } from './analytics.validation';

class AnalyticsController {
  overview = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getOverview(user, query);
    return ApiResponse.ok(res, data, 'Analytics overview');
  });

  students = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getStudents(user, query);
    return ApiResponse.ok(res, data, 'Student analytics');
  });

  seats = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getSeats(user, query);
    return ApiResponse.ok(res, data, 'Seat analytics');
  });

  attendance = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getAttendance(user, query);
    return ApiResponse.ok(res, data, 'Attendance analytics');
  });

  revenue = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getRevenue(user, query);
    return ApiResponse.ok(res, data, 'Revenue analytics');
  });

  payments = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getPayments(user, query);
    return ApiResponse.ok(res, data, 'Payment analytics');
  });

  branches = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getBranches(user, query);
    return ApiResponse.ok(res, data, 'Branch performance');
  });

  trendsDaily = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getTrendsDaily(user, query);
    return ApiResponse.ok(res, data, 'Daily trends');
  });

  trendsMonthly = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as AnalyticsQuery;
    const data = await analyticsService.getTrendsMonthly(user, query);
    return ApiResponse.ok(res, data, 'Monthly trends');
  });
}

export const analyticsController = new AnalyticsController();
