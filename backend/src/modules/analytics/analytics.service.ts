import { Types } from 'mongoose';

import { PERMISSIONS, type PermissionName } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { AttendanceModel } from '@modules/attendance/attendance.model';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { LIBRARY_STATUS } from '@modules/library/library.constants';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { PaymentRecordModel } from '@modules/payments/payment-record.model';
import { SeatModel } from '@modules/seats/seat.model';
import { StudentModel } from '@modules/students/students.models';
import { STUDENT_STATUS } from '@modules/students/student.constants';

import type { AnalyticsQuery } from './analytics.validation';

const EPS = 0.009;

function userCan(user: AuthenticatedUser, permission: PermissionName): boolean {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.permissions.includes(permission);
}

function assertAnalyticsAccess(user: AuthenticatedUser): void {
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (
    !user.permissions.includes(PERMISSIONS.ANALYTICS_VIEW) &&
    !user.permissions.includes(PERMISSIONS.REPORT_VIEW)
  ) {
    throw ApiError.forbidden('Insufficient permissions');
  }
  if (user.role === ROLES.STUDENT) throw ApiError.forbidden('Insufficient permissions');
}

function buildTenantMatch(user: AuthenticatedUser, query: AnalyticsQuery): Record<string, unknown> {
  if (user.role === ROLES.SUPER_ADMIN) {
    const m: Record<string, unknown> = {};
    if (query.libraryId) m.libraryId = new Types.ObjectId(query.libraryId);
    if (query.branchId) m.branchId = new Types.ObjectId(query.branchId);
    return m;
  }
  if (!user.libraryId) throw ApiError.forbidden('Library context required');
  const m: Record<string, unknown> = { libraryId: new Types.ObjectId(user.libraryId) };
  if (user.branchId) {
    m.branchId = new Types.ObjectId(user.branchId);
  } else if (query.branchId) {
    m.branchId = new Types.ObjectId(query.branchId);
  }
  return m;
}

async function validateBranchQuery(user: AuthenticatedUser, query: AnalyticsQuery): Promise<void> {
  if (user.branchId && query.branchId && query.branchId !== user.branchId) {
    throw ApiError.forbidden('Cannot access another branch');
  }
  if (!query.branchId) return;
  const b = await BranchModel.findById(query.branchId).select('libraryId').lean();
  if (!b) throw ApiError.badRequest('Branch not found');
  if (user.role === ROLES.SUPER_ADMIN) {
    if (query.libraryId && String(b.libraryId) !== query.libraryId) {
      throw ApiError.badRequest('Branch does not belong to the selected library');
    }
    return;
  }
  if (!user.libraryId || String(b.libraryId) !== user.libraryId) {
    throw ApiError.forbidden('Invalid branch');
  }
}

function resolveDateRange(query: AnalyticsQuery): { from: Date; to: Date } {
  const to = query.toDate ?? new Date();
  if (query.fromDate && query.toDate) {
    return { from: query.fromDate, to: query.toDate };
  }
  if (query.fromDate) {
    return { from: query.fromDate, to };
  }
  const from = new Date(to);
  switch (query.range) {
    case '7d':
      from.setUTCDate(from.getUTCDate() - 7);
      break;
    case '90d':
      from.setUTCDate(from.getUTCDate() - 90);
      break;
    case '365d':
      from.setUTCDate(from.getUTCDate() - 365);
      break;
    case '30d':
    case 'custom':
    default:
      from.setUTCDate(from.getUTCDate() - 30);
      break;
  }
  return { from, to };
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

class AnalyticsService {
  async getOverview(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const today0 = startOfUtcDay(now);
    const today1 = endOfUtcDay(now);

    const [
      studentAgg,
      seatAgg,
      activeIn,
      todayAttendance,
      invAgg,
      payMonth,
      payToday,
      revenueLife,
      duesAgg,
    ] = await Promise.all([
      StudentModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            activeStudents: { $sum: { $cond: [{ $eq: ['$status', STUDENT_STATUS.ACTIVE] }, 1, 0] } },
            inactiveStudents: {
              $sum: {
                $cond: [{ $in: ['$status', [STUDENT_STATUS.INACTIVE, STUDENT_STATUS.SUSPENDED]] }, 1, 0],
              },
            },
          },
        },
      ]),
      SeatModel.aggregate([
        { $match: { ...match, active: true } },
        {
          $group: {
            _id: null,
            totalSeats: { $sum: 1 },
            occupiedSeats: {
              $sum: {
                $cond: [{ $or: [{ $eq: ['$occupied', true] }, { $eq: ['$status', 'OCCUPIED'] }] }, 1, 0],
              },
            },
            availableSeats: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'AVAILABLE'] },
                      { $ne: ['$occupied', true] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            reservedSeats: { $sum: { $cond: [{ $eq: ['$status', 'RESERVED'] }, 1, 0] } },
            maintenanceSeats: { $sum: { $cond: [{ $eq: ['$status', 'MAINTENANCE'] }, 1, 0] } },
          },
        },
      ]),
      AttendanceModel.countDocuments({
        ...match,
        status: 'CHECKED_IN',
        checkOutAt: null,
      }),
      AttendanceModel.countDocuments({
        ...match,
        date: { $gte: today0, $lte: today1 },
        checkInAt: { $ne: null },
      }),
      InvoiceModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalInvoices: { $sum: 1 },
            unpaidInvoices: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$dueAmount', EPS] },
                      { $in: ['$status', ['UNPAID', 'PARTIAL', 'OVERDUE']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            overdueInvoices: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gt: ['$dueAmount', EPS] },
                      { $lt: ['$dueDate', now] },
                      { $in: ['$status', ['UNPAID', 'PARTIAL']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      PaymentRecordModel.aggregate([
        {
          $match: {
            ...match,
            status: 'ACTIVE',
            paidAt: { $gte: monthStart, $lte: now },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentRecordModel.aggregate([
        {
          $match: {
            ...match,
            status: 'ACTIVE',
            paidAt: { $gte: today0, $lte: today1 },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      PaymentRecordModel.aggregate([
        { $match: { ...match, status: 'ACTIVE' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      InvoiceModel.aggregate([
        {
          $match: {
            ...match,
            dueAmount: { $gt: EPS },
            status: { $nin: ['PAID', 'CANCELLED', 'REFUNDED', 'DRAFT'] },
          },
        },
        { $group: { _id: null, pendingDues: { $sum: '$dueAmount' } } },
      ]),
    ]);

    const s0 = studentAgg[0] as
      | { totalStudents?: number; activeStudents?: number; inactiveStudents?: number }
      | undefined;
    const t0 = seatAgg[0] as
      | {
          totalSeats?: number;
          occupiedSeats?: number;
          availableSeats?: number;
          reservedSeats?: number;
          maintenanceSeats?: number;
        }
      | undefined;
    const i0 = invAgg[0] as
      | { totalInvoices?: number; unpaidInvoices?: number; overdueInvoices?: number }
      | undefined;

    const totalSeats = t0?.totalSeats ?? 0;
    const occupiedSeats = t0?.occupiedSeats ?? 0;
    const occupancyPct =
      totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 10000) / 100 : 0;

    const platform =
      user.role === ROLES.SUPER_ADMIN && !query.libraryId && userCan(user, PERMISSIONS.PAYMENT_READ)
        ? await this.getPlatformSnapshot(now)
        : null;

    const base: Record<string, unknown> = {
      scope: { libraryId: query.libraryId ?? null, branchId: query.branchId ?? null },
      totalStudents: s0?.totalStudents ?? 0,
      activeStudents: s0?.activeStudents ?? 0,
      inactiveStudents: s0?.inactiveStudents ?? 0,
      totalSeats,
      occupiedSeats,
      availableSeats: t0?.availableSeats ?? 0,
      reservedSeats: t0?.reservedSeats ?? 0,
      maintenanceSeats: t0?.maintenanceSeats ?? 0,
      occupancyPct,
      activeCheckIns: activeIn,
      todayAttendance,
      totalInvoices: i0?.totalInvoices ?? 0,
      unpaidInvoices: i0?.unpaidInvoices ?? 0,
      overdueInvoices: i0?.overdueInvoices ?? 0,
      totalRevenue: revenueLife[0]?.total ?? 0,
      monthlyRevenue: payMonth[0]?.total ?? 0,
      todayCollection: payToday[0]?.total ?? 0,
      pendingDues: duesAgg[0]?.pendingDues ?? 0,
      platform,
    };

    if (!userCan(user, PERMISSIONS.STUDENT_READ)) {
      base.totalStudents = null;
      base.activeStudents = null;
      base.inactiveStudents = null;
    }
    if (!userCan(user, PERMISSIONS.SEAT_READ) && !userCan(user, PERMISSIONS.SEAT_OCCUPANCY_READ)) {
      base.totalSeats = null;
      base.occupiedSeats = null;
      base.availableSeats = null;
      base.reservedSeats = null;
      base.maintenanceSeats = null;
      base.occupancyPct = null;
    }
    if (!userCan(user, PERMISSIONS.ATTENDANCE_READ)) {
      base.activeCheckIns = null;
      base.todayAttendance = null;
    }
    if (!userCan(user, PERMISSIONS.PAYMENT_READ)) {
      base.totalInvoices = null;
      base.unpaidInvoices = null;
      base.overdueInvoices = null;
      base.totalRevenue = null;
      base.monthlyRevenue = null;
      base.todayCollection = null;
      base.pendingDues = null;
      base.platform = null;
    }

    return base;
  }

  private async getPlatformSnapshot(now: Date) {
    const [activeLibraries, topLibraries] = await Promise.all([
      LibraryModel.countDocuments({ status: LIBRARY_STATUS.ACTIVE }),
      PaymentRecordModel.aggregate([
        { $match: { status: 'ACTIVE', paidAt: { $gte: new Date(now.getTime() - 365 * 86400000) } } },
        { $group: { _id: '$libraryId', revenue: { $sum: '$amount' } } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: LibraryModel.collection.collectionName,
            localField: '_id',
            foreignField: '_id',
            as: 'lib',
          },
        },
        { $unwind: '$lib' },
        {
          $project: {
            libraryId: { $toString: '$_id' },
            name: '$lib.name',
            revenue: 1,
          },
        },
      ]),
    ]);
    const payAll = await PaymentRecordModel.aggregate([
      { $match: { status: 'ACTIVE', paidAt: { $gte: new Date(now.getTime() - 365 * 86400000) } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return {
      activeLibraries,
      platformRevenue365d: payAll[0]?.total ?? 0,
      topLibrariesByRevenue: topLibraries,
    };
  }

  async getStudents(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);
    const { from, to } = resolveDateRange(query);
    const brCol = BranchModel.collection.collectionName;

    const [byBranch, byStatus, newTrend, assigned] = await Promise.all([
      StudentModel.aggregate([
        { $match: match },
        {
          $lookup: {
            from: brCol,
            localField: 'branchId',
            foreignField: '_id',
            as: 'br',
          },
        },
        { $unwind: '$br' },
        {
          $group: {
            _id: '$branchId',
            branchName: { $first: '$br.branchName' },
            count: { $sum: 1 },
          },
        },
        { $project: { branchId: { $toString: '$_id' }, branchName: 1, count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      StudentModel.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } },
      ]),
      StudentModel.aggregate([
        { $match: { ...match, createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } },
      ]),
      StudentModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            withSeat: { $sum: { $cond: [{ $ne: ['$assignedSeatId', null] }, 1, 0] } },
            total: { $sum: 1 },
          },
        },
      ]),
    ]);

    const seatTotal = await SeatModel.countDocuments({ ...match, active: true });
    const a0 = assigned[0] as { withSeat?: number; total?: number } | undefined;
    const withSeat = a0?.withSeat ?? 0;
    const seatUtilizationPct =
      seatTotal > 0 ? Math.round((withSeat / seatTotal) * 10000) / 100 : 0;

    return {
      byBranch,
      byMembershipStatus: byStatus,
      newStudentTrend: newTrend,
      activeVsInactive: {
        active: await StudentModel.countDocuments({ ...match, status: STUDENT_STATUS.ACTIVE }),
        inactive: await StudentModel.countDocuments({
          ...match,
          status: { $in: [STUDENT_STATUS.INACTIVE, STUDENT_STATUS.SUSPENDED] },
        }),
      },
      seatUtilizationPct,
      range: { from, to },
    };
  }

  async getSeats(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);

    const [byBranch, byFloor, byZone, statusCounts] = await Promise.all([
      SeatModel.aggregate([
        { $match: { ...match, active: true } },
        {
          $group: {
            _id: '$branchId',
            total: { $sum: 1 },
            occupied: {
              $sum: { $cond: [{ $or: [{ $eq: ['$occupied', true] }, { $eq: ['$status', 'OCCUPIED'] }] }, 1, 0] },
            },
          },
        },
        {
          $project: {
            branchId: { $toString: '$_id' },
            total: 1,
            occupied: 1,
            occupancyPct: {
              $cond: [{ $gt: ['$total', 0] }, { $multiply: [{ $divide: ['$occupied', '$total'] }, 100] }, 0],
            },
            _id: 0,
          },
        },
      ]),
      SeatModel.aggregate([
        { $match: { ...match, active: true } },
        {
          $group: {
            _id: '$floor',
            total: { $sum: 1 },
            occupied: {
              $sum: { $cond: [{ $or: [{ $eq: ['$occupied', true] }, { $eq: ['$status', 'OCCUPIED'] }] }, 1, 0] },
            },
          },
        },
        { $project: { floor: '$_id', total: 1, occupied: 1, _id: 0 } },
        { $sort: { floor: 1 } },
      ]),
      SeatModel.aggregate([
        { $match: { ...match, active: true } },
        {
          $group: {
            _id: '$zone',
            total: { $sum: 1 },
            occupied: {
              $sum: { $cond: [{ $or: [{ $eq: ['$occupied', true] }, { $eq: ['$status', 'OCCUPIED'] }] }, 1, 0] },
            },
          },
        },
        { $project: { zone: '$_id', total: 1, occupied: 1, _id: 0 } },
        { $sort: { zone: 1 } },
      ]),
      SeatModel.aggregate([
        { $match: { ...match, active: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    return { byBranch, byFloor, byZone, byStatus: statusCounts };
  }

  async getAttendance(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);
    const { from, to } = resolveDateRange(query);
    const dayMatch = { ...match, date: { $gte: startOfUtcDay(from), $lte: endOfUtcDay(to) } };

    const [daily, dur, peak, activeIn, byBranch] = await Promise.all([
      AttendanceModel.aggregate([
        { $match: dayMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
            sessions: { $sum: 1 },
            checkIns: { $sum: { $cond: [{ $ne: ['$checkInAt', null] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', sessions: 1, checkIns: 1, _id: 0 } },
      ]),
      AttendanceModel.aggregate([
        {
          $match: {
            ...match,
            checkInAt: { $gte: from, $lte: to },
            checkOutAt: { $ne: null },
            durationMinutes: { $gt: 0 },
          },
        },
        { $group: { _id: null, avgMinutes: { $avg: '$durationMinutes' } } },
      ]),
      AttendanceModel.aggregate([
        {
          $match: {
            ...match,
            checkInAt: { $gte: from, $lte: to },
          },
        },
        { $group: { _id: { $hour: '$checkInAt' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
        { $project: { hour: '$_id', count: 1, _id: 0 } },
      ]),
      AttendanceModel.countDocuments({
        ...match,
        status: 'CHECKED_IN',
        checkOutAt: null,
      }),
      AttendanceModel.aggregate([
        { $match: { ...match, checkInAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$branchId', sessions: { $sum: 1 } } },
        { $project: { branchId: { $toString: '$_id' }, sessions: 1, _id: 0 } },
      ]),
    ]);

    return {
      dailyTrend: daily,
      averageDurationMinutes: Math.round((dur[0]?.avgMinutes as number) || 0),
      peakCheckInHours: peak,
      activeCheckIns: activeIn,
      byBranch,
      range: { from, to },
    };
  }

  async getRevenue(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);
    const { from, to } = resolveDateRange(query);

    const trend = await PaymentRecordModel.aggregate([
      { $match: { ...match, status: 'ACTIVE', paidAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'UTC' } },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', amount: 1, _id: 0 } },
    ]);

    const total = trend.reduce((a, r: { amount?: number }) => a + (r.amount ?? 0), 0);

    return { trend, totalInRange: total, range: { from, to } };
  }

  async getPayments(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);
    const { from, to } = resolveDateRange(query);
    const now = new Date();

    const [methodDist, branchCollection, overdueTrend, invFinancials, dueTrend, invoiceStatus] =
      await Promise.all([
      PaymentRecordModel.aggregate([
        { $match: { ...match, status: 'ACTIVE', paidAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$method', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $project: { method: '$_id', amount: 1, count: 1, _id: 0 } },
      ]),
      PaymentRecordModel.aggregate([
        { $match: { ...match, status: 'ACTIVE', paidAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$branchId', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $project: { branchId: { $toString: '$_id' }, amount: 1, count: 1, _id: 0 } },
      ]),
      InvoiceModel.aggregate([
        {
          $match: {
            ...match,
            dueDate: { $gte: from, $lte: to },
            dueAmount: { $gt: EPS },
            status: { $in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$dueDate', timezone: 'UTC' } },
            overdueCount: { $sum: 1 },
            dueAmount: { $sum: '$dueAmount' },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', overdueCount: 1, dueAmount: 1, _id: 0 } },
      ]),
      InvoiceModel.aggregate([
        { $match: { ...match, createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: null,
            billed: { $sum: '$totalAmount' },
            collected: { $sum: '$paidAmount' },
          },
        },
      ]),
      InvoiceModel.aggregate([
        { $match: { ...match, createdAt: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
            newDue: { $sum: '$dueAmount' },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', newDue: 1, _id: 0 } },
      ]),
      InvoiceModel.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    const f = invFinancials[0] as { billed?: number; collected?: number } | undefined;
    const billed = f?.billed ?? 0;
    const collected = f?.collected ?? 0;
    const collectionEfficiencyPct =
      billed > EPS ? Math.round((collected / billed) * 10000) / 100 : 0;

    const overdueCount = await InvoiceModel.countDocuments({
      ...match,
      dueAmount: { $gt: EPS },
      dueDate: { $lt: now },
      status: { $in: ['UNPAID', 'PARTIAL'] },
    });

    return {
      methodDistribution: methodDist,
      branchWiseCollection: branchCollection,
      overdueTrend,
      dueTrend,
      collectionEfficiencyPct,
      currentOverdueInvoices: overdueCount,
      invoiceStatusBreakdown: invoiceStatus,
      range: { from, to },
    };
  }

  async getBranches(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);
    const { from, to } = resolveDateRange(query);

    const branchLibraryFilter: Record<string, unknown> =
      user.role === ROLES.SUPER_ADMIN && query.libraryId
        ? { libraryId: new Types.ObjectId(query.libraryId) }
        : user.role === ROLES.SUPER_ADMIN && !query.libraryId
          ? {}
          : { libraryId: new Types.ObjectId(user.libraryId!) };

    const branchQuery: Record<string, unknown> = { ...branchLibraryFilter };
    if (match.branchId) branchQuery._id = match.branchId as Types.ObjectId;

    const branches = await BranchModel.find(branchQuery)
      .select('_id branchName branchCode')
      .limit(500)
      .lean();

    const results = await Promise.all(
      branches.map(async (b) => {
        const bMatch = { ...match, branchId: b._id };
        const [students, seats, revenue, att] = await Promise.all([
          StudentModel.countDocuments(bMatch),
          SeatModel.aggregate([
            { $match: { ...bMatch, active: true } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                occupied: {
                  $sum: {
                    $cond: [{ $or: [{ $eq: ['$occupied', true] }, { $eq: ['$status', 'OCCUPIED'] }] }, 1, 0],
                  },
                },
              },
            },
          ]),
          PaymentRecordModel.aggregate([
            { $match: { ...bMatch, status: 'ACTIVE', paidAt: { $gte: from, $lte: to } } },
            { $group: { _id: null, amount: { $sum: '$amount' } } },
          ]),
          AttendanceModel.countDocuments({
            ...bMatch,
            checkInAt: { $gte: from, $lte: to },
          }),
        ]);
        const s0 = seats[0] as { total?: number; occupied?: number } | undefined;
        const total = s0?.total ?? 0;
        const occ = s0?.occupied ?? 0;
        return {
          branchId: String(b._id),
          branchName: b.branchName,
          branchCode: b.branchCode,
          studentCount: students,
          seatTotal: total,
          seatOccupied: occ,
          occupancyPct: total > 0 ? Math.round((occ / total) * 10000) / 100 : 0,
          revenueInRange: revenue[0]?.amount ?? 0,
          attendanceSessionsInRange: att,
        };
      }),
    );

    return { branches: results, range: { from, to } };
  }

  async getTrendsDaily(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);
    const { from, to } = resolveDateRange(query);

    const incAtt = userCan(user, PERMISSIONS.ATTENDANCE_READ);
    const incPay = userCan(user, PERMISSIONS.PAYMENT_READ);
    const incStu = userCan(user, PERMISSIONS.STUDENT_READ);

    const [payments, attendance, students] = await Promise.all([
      incPay
        ? PaymentRecordModel.aggregate([
            { $match: { ...match, status: 'ACTIVE', paidAt: { $gte: from, $lte: to } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'UTC' } },
                revenue: { $sum: '$amount' },
              },
            },
          ])
        : Promise.resolve([]),
      incAtt
        ? AttendanceModel.aggregate([
            { $match: { ...match, date: { $gte: startOfUtcDay(from), $lte: endOfUtcDay(to) } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: 'UTC' } },
                attendance: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
      incStu
        ? StudentModel.aggregate([
            { $match: { ...match, createdAt: { $gte: from, $lte: to } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
                newStudents: { $sum: 1 },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const map = new Map<string, { date: string; revenue: number; attendance: number; newStudents: number }>();
    const add = (date: string, field: 'revenue' | 'attendance' | 'newStudents', v: number) => {
      const cur = map.get(date) ?? { date, revenue: 0, attendance: 0, newStudents: 0 };
      cur[field] += v;
      map.set(date, cur);
    };
    for (const r of payments as { _id: string; revenue?: number }[]) add(r._id, 'revenue', r.revenue ?? 0);
    for (const r of attendance as { _id: string; attendance?: number }[]) {
      add(r._id, 'attendance', r.attendance ?? 0);
    }
    for (const r of students as { _id: string; newStudents?: number }[]) {
      add(r._id, 'newStudents', r.newStudents ?? 0);
    }
    const series = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    return { series, range: { from, to } };
  }

  async getTrendsMonthly(user: AuthenticatedUser, query: AnalyticsQuery) {
    assertAnalyticsAccess(user);
    await validateBranchQuery(user, query);
    const match = buildTenantMatch(user, query);
    const { from, to } = resolveDateRange(query);

    const incAtt = userCan(user, PERMISSIONS.ATTENDANCE_READ);
    const incPay = userCan(user, PERMISSIONS.PAYMENT_READ);

    const [payments, attendance] = await Promise.all([
      incPay
        ? PaymentRecordModel.aggregate([
            { $match: { ...match, status: 'ACTIVE', paidAt: { $gte: from, $lte: to } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: 'UTC' } },
                revenue: { $sum: '$amount' },
              },
            },
            { $sort: { _id: 1 } },
          ])
        : Promise.resolve([]),
      incAtt
        ? AttendanceModel.aggregate([
            { $match: { ...match, date: { $gte: from, $lte: to } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$date', timezone: 'UTC' } },
                attendance: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
        : Promise.resolve([]),
    ]);

    const map = new Map<string, { month: string; revenue: number; attendance: number }>();
    for (const r of payments as { _id: string; revenue?: number }[]) {
      const cur = map.get(r._id) ?? { month: r._id, revenue: 0, attendance: 0 };
      cur.revenue += r.revenue ?? 0;
      map.set(r._id, cur);
    }
    for (const r of attendance as { _id: string; attendance?: number }[]) {
      const cur = map.get(r._id) ?? { month: r._id, revenue: 0, attendance: 0 };
      cur.attendance += r.attendance ?? 0;
      map.set(r._id, cur);
    }
    const series = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    return { series, range: { from, to } };
  }
}

export const analyticsService = new AnalyticsService();
