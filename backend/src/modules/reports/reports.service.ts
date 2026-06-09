import { Types, type PipelineStage } from 'mongoose';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { enrichRowsWithLookups } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { AttendanceModel } from '@modules/attendance/attendance.model';
import { BranchModel } from '@modules/library/library.models';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { PaymentRecordModel } from '@modules/payments/payment-record.model';
import {
  INVOICE_SORT_FIELDS,
  PAYMENT_SORT_FIELDS,
  type InvoiceSortField,
  type PaymentSortField,
} from '@modules/payments/payment.constants';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { SeatModel } from '@modules/seats/seat.model';
import { ShiftModel } from '@modules/shifts/shift.model';
import { StudentModel } from '@modules/students/students.models';

import {
  assertReportAccess,
  buildTenantMatch,
  EXPORT_ROW_CAP,
  validateBranchQuery,
  resolveDateRange,
} from './reports-scope';
import type { ReportExportQuery, ReportListQuery } from './reports.validation';
import { buildExportBuffer } from './reports-export.util';
import type { ExportFormat } from './reports-export.util';
import { parseColumnsQuery, prepareExportRows } from './reports-export-columns.util';
import type { ReportType } from './reports-columns.constants';

const EPS = 0.009;

const STUDENT_SORT = ['createdAt', 'fullName', 'admissionDate', 'studentId', 'status', 'email'] as const;
const ATTENDANCE_SORT = ['date', 'checkInAt', 'durationMinutes', 'status', 'createdAt'] as const;
const SEAT_SORT = ['seatNumber', 'floor', 'zone', 'status', 'createdAt', 'occupied'] as const;
const BRANCH_SORT = ['branchName', 'branchCode', 'createdAt'] as const;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertSuperLibrary(user: AuthenticatedUser, query: ReportListQuery): void {
  if (user.role === ROLES.SUPER_ADMIN && !query.libraryId) {
    throw ApiError.badRequest('libraryId is required for platform administrators');
  }
}

function assertOperationalReportAllowed(user: AuthenticatedUser): void {
  if (user.role === ROLES.ACCOUNTANT) {
    throw ApiError.forbidden('This operational report is not available for the accountant role');
  }
}

function assertFinanceReport(user: AuthenticatedUser): void {
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (!user.permissions.includes(PERMISSIONS.PAYMENT_READ)) {
    throw ApiError.forbidden('Insufficient permissions');
  }
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

function pickSort(
  allowed: readonly string[],
  sortBy: string | undefined,
  fallback: string,
  order: 'asc' | 'desc',
): Record<string, 1 | -1> {
  const key = allowed.includes(sortBy ?? '') ? sortBy! : fallback;
  return { [key]: order === 'asc' ? 1 : -1 };
}

function oid(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

function serializeStudent(doc: Record<string, unknown>): Record<string, unknown> {
  return {
    _id: String(doc._id),
    libraryId: String(doc.libraryId),
    branchId: String(doc.branchId),
    studentId: doc.studentId,
    fullName: doc.fullName,
    email: doc.email,
    phone: doc.phone ?? '',
    status: doc.status,
    admissionDate: doc.admissionDate,
    membershipStartDate: doc.membershipStartDate,
    membershipEndDate: doc.membershipEndDate ?? null,
    assignedSeatId: doc.assignedSeatId ? String(doc.assignedSeatId) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class ReportsService {
  async listStudents(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    assertOperationalReportAllowed(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
    const { from, to } = resolveDateRange(query);
    match.createdAt = { $gte: from, $lte: to };
    if (query.studentId) match._id = oid(query.studentId);
    if (query.status) match.status = query.status;
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      match.$or = [{ fullName: rx }, { studentId: rx }, { email: rx }, { phone: rx }];
    }
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sort = pickSort(STUDENT_SORT, query.sortBy, 'createdAt', query.sortOrder);
    const [items, total] = await Promise.all([
      StudentModel.find(match).sort(sort).skip(skip).limit(limit).lean(),
      StudentModel.countDocuments(match),
    ]);
    const serialized = items.map((d) => serializeStudent(d as unknown as Record<string, unknown>));
    const enriched = await enrichRowsWithLookups(serialized, {
      branchIdKey: 'branchId',
      seatIdKey: 'assignedSeatId',
    });
    return {
      items: enriched,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async listAttendance(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    assertOperationalReportAllowed(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
    const { from, to } = resolveDateRange(query);
    match.date = { $gte: startOfUtcDay(from), $lte: endOfUtcDay(to) };
    if (query.studentId) match.studentId = oid(query.studentId);
    if (query.seatId) match.seatId = oid(query.seatId);
    if (query.status) match.status = query.status;
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sort = pickSort(ATTENDANCE_SORT, query.sortBy, 'date', query.sortOrder);
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: sort },
      {
        $lookup: {
          from: StudentModel.collection.name,
          localField: 'studentId',
          foreignField: '_id',
          as: '_stu',
        },
      },
      { $addFields: { studentName: { $arrayElemAt: ['$_stu.fullName', 0] }, studentCode: { $arrayElemAt: ['$_stu.studentId', 0] } } },
      { $project: { _stu: 0 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'c' }],
        },
      },
    ];
    const agg = await AttendanceModel.aggregate(pipeline);
    const bucket = agg[0] as { items: Record<string, unknown>[]; total: { c: number }[] };
    const items = (bucket?.items ?? []).map((r) => ({
      _id: String(r._id),
      libraryId: String(r.libraryId),
      branchId: String(r.branchId),
      studentId: String(r.studentId),
      studentName: r.studentName ?? '',
      studentCode: r.studentCode ?? '',
      seatId: r.seatId ? String(r.seatId) : null,
      date: r.date,
      checkInAt: r.checkInAt,
      checkOutAt: r.checkOutAt,
      durationMinutes: r.durationMinutes,
      status: r.status,
      method: r.method,
      createdAt: r.createdAt,
    }));
    const total = bucket?.total?.[0]?.c ?? 0;
    return {
      items,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async listPayments(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    assertFinanceReport(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
    const { from, to } = resolveDateRange(query);
    match.paidAt = { $gte: from, $lte: to };
    if (query.studentId) match.studentId = oid(query.studentId);
    if (query.paymentMethod) match.method = query.paymentMethod;
    if (query.status) match.status = query.status;
    else match.status = 'ACTIVE';
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sortField = (PAYMENT_SORT_FIELDS as readonly string[]).includes(query.sortBy ?? '')
      ? (query.sortBy as PaymentSortField)
      : 'paidAt';
    const sort: Record<string, 1 | -1> = { [sortField]: query.sortOrder === 'asc' ? 1 : -1 };
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: sort },
      {
        $lookup: {
          from: InvoiceModel.collection.name,
          localField: 'invoiceId',
          foreignField: '_id',
          as: '_inv',
        },
      },
      { $addFields: { invoiceNumber: { $arrayElemAt: ['$_inv.invoiceNumber', 0] } } },
      { $project: { _inv: 0 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'c' }],
        },
      },
    ];
    const agg = await PaymentRecordModel.aggregate(pipeline);
    const bucket = agg[0] as { items: Record<string, unknown>[]; total: { c: number }[] };
    const items = (bucket?.items ?? []).map((r) => ({
      _id: String(r._id),
      libraryId: String(r.libraryId),
      branchId: String(r.branchId),
      studentId: String(r.studentId),
      invoiceId: String(r.invoiceId),
      invoiceNumber: r.invoiceNumber ?? '',
      amount: r.amount,
      method: r.method,
      receiptNumber: r.receiptNumber,
      paidAt: r.paidAt,
      status: r.status,
      refundedAmount: r.refundedAmount,
      createdAt: r.createdAt,
    }));
    const total = bucket?.total?.[0]?.c ?? 0;
    return {
      items,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async listInvoices(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    assertFinanceReport(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
    const { from, to } = resolveDateRange(query);
    match.createdAt = { $gte: from, $lte: to };
    if (query.studentId) match.studentId = oid(query.studentId);
    if (query.invoiceStatus) match.status = query.invoiceStatus;
    else if (query.status) match.status = query.status;
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sortField = (INVOICE_SORT_FIELDS as readonly string[]).includes(query.sortBy ?? '')
      ? (query.sortBy as InvoiceSortField)
      : 'createdAt';
    const sort: Record<string, 1 | -1> = { [sortField]: query.sortOrder === 'asc' ? 1 : -1 };
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: sort },
      {
        $lookup: {
          from: StudentModel.collection.name,
          localField: 'studentId',
          foreignField: '_id',
          as: '_stu',
        },
      },
      { $addFields: { studentName: { $arrayElemAt: ['$_stu.fullName', 0] }, studentCode: { $arrayElemAt: ['$_stu.studentId', 0] } } },
      { $project: { _stu: 0 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'c' }],
        },
      },
    ];
    const agg = await InvoiceModel.aggregate(pipeline);
    const bucket = agg[0] as { items: Record<string, unknown>[]; total: { c: number }[] };
    const items = (bucket?.items ?? []).map((r) => ({
      _id: String(r._id),
      libraryId: String(r.libraryId),
      branchId: String(r.branchId),
      studentId: String(r.studentId),
      studentName: r.studentName ?? '',
      studentCode: r.studentCode ?? '',
      invoiceNumber: r.invoiceNumber,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      dueAmount: r.dueAmount,
      status: r.status,
      dueDate: r.dueDate,
      downgradeDueDate: r.downgradeDueDate ?? null,
      downgradeIfUnpaid: r.downgradeIfUnpaid ?? false,
      selectedDurationDays: r.selectedDurationDays ?? null,
      downgradeDurationDays: r.downgradeDurationDays ?? null,
      currency: r.currency,
      createdAt: r.createdAt,
    }));
    const total = bucket?.total?.[0]?.c ?? 0;
    return {
      items,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async listSeats(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    assertOperationalReportAllowed(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const match: Record<string, unknown> = { ...buildTenantMatch(user, query), active: true };
    const { from, to } = resolveDateRange(query);
    match.updatedAt = { $gte: from, $lte: to };
    if (query.seatId) match._id = oid(query.seatId);
    if (query.status) match.status = query.status;
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sort = pickSort(SEAT_SORT, query.sortBy, 'seatNumber', query.sortOrder);
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: sort },
      {
        $lookup: {
          from: StudentModel.collection.name,
          localField: 'assignedStudentId',
          foreignField: '_id',
          as: '_stu',
        },
      },
      {
        $addFields: {
          assignedStudentName: { $arrayElemAt: ['$_stu.fullName', 0] },
          assignedStudentCode: { $arrayElemAt: ['$_stu.studentId', 0] },
        },
      },
      { $project: { _stu: 0 } },
      {
        $lookup: {
          from: SeatAssignmentModel.collection.name,
          let: { seatId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$seatId', '$$seatId'] },
                status: { $in: ['ACTIVE', 'RESERVED'] },
              },
            },
            {
              $lookup: {
                from: StudentModel.collection.name,
                localField: 'studentId',
                foreignField: '_id',
                as: '_stu',
              },
            },
            {
              $lookup: {
                from: ShiftModel.collection.name,
                localField: 'shiftId',
                foreignField: '_id',
                as: '_sh',
              },
            },
            {
              $project: {
                shiftName: { $arrayElemAt: ['$_sh.name', 0] },
                studentName: { $arrayElemAt: ['$_stu.fullName', 0] },
                studentCode: { $arrayElemAt: ['$_stu.studentId', 0] },
                status: 1,
              },
            },
          ],
          as: '_assignments',
        },
      },
      {
        $addFields: {
          shiftOccupancy: {
            $reduce: {
              input: '$_assignments',
              initialValue: '',
              in: {
                $concat: [
                  '$$value',
                  { $cond: [{ $eq: ['$$value', ''] }, '', '; '] },
                  { $ifNull: ['$$this.shiftName', 'Shift'] },
                  ': ',
                  { $ifNull: ['$$this.studentName', '—'] },
                ],
              },
            },
          },
        },
      },
      { $project: { _assignments: 0 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'c' }],
        },
      },
    ];
    const agg = await SeatModel.aggregate(pipeline);
    const bucket = agg[0] as { items: Record<string, unknown>[]; total: { c: number }[] };
    const items = (bucket?.items ?? []).map((r) => ({
      _id: String(r._id),
      libraryId: String(r.libraryId),
      branchId: String(r.branchId),
      seatNumber: r.seatNumber,
      floor: r.floor,
      zone: r.zone,
      seatType: r.seatType,
      shiftOccupancy: (r.shiftOccupancy as string) ?? '',
      status: r.status,
      occupied: r.occupied,
      assignedStudentId: r.assignedStudentId ? String(r.assignedStudentId) : null,
      assignedStudentName: r.assignedStudentName ?? '',
      assignedStudentCode: r.assignedStudentCode ?? '',
      updatedAt: r.updatedAt,
    }));
    const total = bucket?.total?.[0]?.c ?? 0;
    return {
      items,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async listDues(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    assertFinanceReport(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
    const { from, to } = resolveDateRange(query);
    match.createdAt = { $gte: from, $lte: to };
    match.dueAmount = { $gt: EPS };
    const duesStatuses = ['UNPAID', 'PARTIAL', 'OVERDUE'];
    match.status = query.invoiceStatus ?? { $in: duesStatuses };
    if (query.studentId) match.studentId = oid(query.studentId);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sortField = (INVOICE_SORT_FIELDS as readonly string[]).includes(query.sortBy ?? '')
      ? (query.sortBy as InvoiceSortField)
      : 'dueDate';
    const sort: Record<string, 1 | -1> = { [sortField]: query.sortOrder === 'asc' ? 1 : -1 };
    const pipeline: PipelineStage[] = [
      { $match: match },
      { $sort: sort },
      {
        $lookup: {
          from: StudentModel.collection.name,
          localField: 'studentId',
          foreignField: '_id',
          as: '_stu',
        },
      },
      { $addFields: { studentName: { $arrayElemAt: ['$_stu.fullName', 0] }, studentCode: { $arrayElemAt: ['$_stu.studentId', 0] } } },
      { $project: { _stu: 0 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'c' }],
        },
      },
    ];
    const agg = await InvoiceModel.aggregate(pipeline);
    const bucket = agg[0] as { items: Record<string, unknown>[]; total: { c: number }[] };
    const items = (bucket?.items ?? []).map((r) => ({
      _id: String(r._id),
      libraryId: String(r.libraryId),
      branchId: String(r.branchId),
      studentId: String(r.studentId),
      studentName: r.studentName ?? '',
      studentCode: r.studentCode ?? '',
      invoiceNumber: r.invoiceNumber,
      totalAmount: r.totalAmount,
      paidAmount: r.paidAmount,
      dueAmount: r.dueAmount,
      status: r.status,
      dueDate: r.dueDate,
      currency: r.currency,
      createdAt: r.createdAt,
    }));
    const total = bucket?.total?.[0]?.c ?? 0;
    return {
      items,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async listBranches(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const baseMatch = buildTenantMatch(user, query);
    const { from, to } = resolveDateRange(query);
    const libraryOid =
      user.role === ROLES.SUPER_ADMIN
        ? oid(query.libraryId!)
        : oid(user.libraryId!);
    const branchMatch: Record<string, unknown> = { libraryId: libraryOid };
    if (baseMatch.branchId) branchMatch._id = baseMatch.branchId;
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const sort = pickSort(BRANCH_SORT, query.sortBy, 'branchName', query.sortOrder);
    const [total, rows] = await Promise.all([
      BranchModel.countDocuments(branchMatch),
      BranchModel.find(branchMatch).sort(sort).skip(skip).limit(limit).lean(),
    ]);
    const branchIds = rows.map((b) => b._id);
    if (branchIds.length === 0) {
      return {
        items: [],
        meta: { pagination: buildPaginationMeta(total, page, limit) },
        range: { from: from.toISOString(), to: to.toISOString() },
      };
    }
    const [stuAgg, seatAgg, payAgg] = await Promise.all([
      StudentModel.aggregate([
        { $match: { libraryId: libraryOid, branchId: { $in: branchIds } } },
        { $group: { _id: '$branchId', studentCount: { $sum: 1 } } },
      ]),
      SeatModel.aggregate([
        { $match: { libraryId: libraryOid, branchId: { $in: branchIds }, active: true } },
        {
          $group: {
            _id: '$branchId',
            seatCount: { $sum: 1 },
            occupiedSeats: {
              $sum: {
                $cond: [{ $or: [{ $eq: ['$occupied', true] }, { $eq: ['$status', 'OCCUPIED'] }] }, 1, 0],
              },
            },
          },
        },
      ]),
      PaymentRecordModel.aggregate([
        {
          $match: {
            libraryId: libraryOid,
            branchId: { $in: branchIds },
            paidAt: { $gte: from, $lte: to },
            status: 'ACTIVE',
          },
        },
        { $group: { _id: '$branchId', collectionAmount: { $sum: '$amount' }, paymentCount: { $sum: 1 } } },
      ]),
    ]);
    const stuMap = new Map(stuAgg.map((x) => [String(x._id), x.studentCount as number]));
    const seatMap = new Map(
      seatAgg.map((x) => [
        String(x._id),
        { seatCount: x.seatCount as number, occupiedSeats: x.occupiedSeats as number },
      ]),
    );
    const payMap = new Map(
      payAgg.map((x) => [
        String(x._id),
        { collectionAmount: x.collectionAmount as number, paymentCount: x.paymentCount as number },
      ]),
    );
    const items = rows.map((b) => {
      const id = String(b._id);
      const s = seatMap.get(id);
      const p = payMap.get(id);
      return {
        _id: id,
        libraryId: String(b.libraryId),
        branchName: b.branchName,
        branchCode: b.branchCode,
        active: b.active,
        totalSeatsDeclared: b.totalSeats,
        studentCount: stuMap.get(id) ?? 0,
        seatCount: s?.seatCount ?? 0,
        occupiedSeats: s?.occupiedSeats ?? 0,
        collectionInRange: p?.collectionAmount ?? 0,
        paymentCountInRange: p?.paymentCount ?? 0,
        createdAt: b.createdAt,
      };
    });
    return {
      items,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async listCollectionsDaily(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    assertFinanceReport(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const match: Record<string, unknown> = { ...buildTenantMatch(user, query), status: 'ACTIVE' };
    const { from, to } = resolveDateRange(query);
    match.paidAt = { $gte: from, $lte: to };
    if (query.paymentMethod) match.method = query.paymentMethod;
    const series = await PaymentRecordModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'UTC' } },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', amount: 1, count: 1 } },
    ]);
    const totalAmount = series.reduce((a, r) => a + (r.amount as number), 0);
    return {
      series,
      totalAmount,
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  async listCollectionsMonthly(user: AuthenticatedUser, query: ReportListQuery) {
    assertReportAccess(user);
    assertFinanceReport(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    const match: Record<string, unknown> = { ...buildTenantMatch(user, query), status: 'ACTIVE' };
    const { from, to } = resolveDateRange(query);
    match.paidAt = { $gte: from, $lte: to };
    if (query.paymentMethod) match.method = query.paymentMethod;
    const series = await PaymentRecordModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: 'UTC' } },
          amount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: '$_id', amount: 1, count: 1 } },
    ]);
    const totalAmount = series.reduce((a, r) => a + (r.amount as number), 0);
    return {
      series,
      totalAmount,
      range: { from: from.toISOString(), to: to.toISOString() },
    };
  }

  private async exportRows(
    user: AuthenticatedUser,
    query: ReportExportQuery,
    loadRows: () => Promise<Record<string, unknown>[]>,
    title: string,
    reportType: ReportType,
    filePrefix: string,
    enrich?: (rows: Record<string, unknown>[]) => Promise<Record<string, unknown>[]>,
  ): Promise<{ body: Buffer; filePrefix: string; format: ExportFormat }> {
    assertReportAccess(user);
    await validateBranchQuery(user, query);
    assertSuperLibrary(user, query);
    let rows = await loadRows();
    if (rows.length > EXPORT_ROW_CAP) {
      throw ApiError.badRequest(`Export limited to ${EXPORT_ROW_CAP} rows; narrow filters`);
    }
    if (enrich) {
      rows = await enrich(rows);
    }
    const requested = parseColumnsQuery(query.columns);
    const { columns, rows: exportRows } = prepareExportRows(reportType, rows, requested);
    const format = query.format as ExportFormat;
    const body = await buildExportBuffer(format, title, columns, exportRows);
    return {
      body,
      filePrefix,
      format,
    };
  }

  exportStudents(user: AuthenticatedUser, query: ReportExportQuery) {
    assertOperationalReportAllowed(user);
    return this.exportRows(
      user,
      query,
      async () => {
        const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
        const { from, to } = resolveDateRange(query);
        match.createdAt = { $gte: from, $lte: to };
        if (query.studentId) match._id = oid(query.studentId);
        if (query.status) match.status = query.status;
        if (query.search) {
          const rx = new RegExp(escapeRegex(query.search), 'i');
          match.$or = [{ fullName: rx }, { studentId: rx }, { email: rx }, { phone: rx }];
        }
        const sort = pickSort(STUDENT_SORT, query.sortBy, 'createdAt', query.sortOrder);
        const docs = await StudentModel.find(match).sort(sort).limit(EXPORT_ROW_CAP).lean();
        return docs.map((d) => serializeStudent(d as unknown as Record<string, unknown>));
      },
      'Student report',
      'students',
      'students-report',
      async (rows) =>
        enrichRowsWithLookups(rows, {
          branchIdKey: 'branchId',
          seatIdKey: 'assignedSeatId',
        }),
    );
  }

  exportAttendance(user: AuthenticatedUser, query: ReportExportQuery) {
    assertOperationalReportAllowed(user);
    return this.exportRows(
      user,
      query,
      async () => {
        const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
        const { from, to } = resolveDateRange(query);
        match.date = { $gte: startOfUtcDay(from), $lte: endOfUtcDay(to) };
        if (query.studentId) match.studentId = oid(query.studentId);
        if (query.seatId) match.seatId = oid(query.seatId);
        if (query.status) match.status = query.status;
        const sort = pickSort(ATTENDANCE_SORT, query.sortBy, 'date', query.sortOrder);
        const pipeline: PipelineStage[] = [
          { $match: match },
          { $sort: sort },
          { $limit: EXPORT_ROW_CAP },
          {
            $lookup: {
              from: StudentModel.collection.name,
              localField: 'studentId',
              foreignField: '_id',
              as: '_stu',
            },
          },
          {
            $addFields: {
              studentName: { $arrayElemAt: ['$_stu.fullName', 0] },
              studentCode: { $arrayElemAt: ['$_stu.studentId', 0] },
            },
          },
          { $project: { _stu: 0 } },
        ];
        const rows = await AttendanceModel.aggregate(pipeline);
        return rows as Record<string, unknown>[];
      },
      'Attendance report',
      'attendance',
      'attendance-report',
      async (rows) =>
        enrichRowsWithLookups(rows, {
          branchIdKey: 'branchId',
          seatIdKey: 'seatId',
        }),
    );
  }

  exportPayments(user: AuthenticatedUser, query: ReportExportQuery) {
    assertFinanceReport(user);
    return this.exportRows(
      user,
      query,
      async () => {
        const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
        const { from, to } = resolveDateRange(query);
        match.paidAt = { $gte: from, $lte: to };
        if (query.studentId) match.studentId = oid(query.studentId);
        if (query.paymentMethod) match.method = query.paymentMethod;
        if (query.status) match.status = query.status;
        else match.status = 'ACTIVE';
        const sortField = (PAYMENT_SORT_FIELDS as readonly string[]).includes(query.sortBy ?? '')
          ? (query.sortBy as PaymentSortField)
          : 'paidAt';
        const sort: Record<string, 1 | -1> = { [sortField]: query.sortOrder === 'asc' ? 1 : -1 };
        const pipeline: PipelineStage[] = [
          { $match: match },
          { $sort: sort },
          { $limit: EXPORT_ROW_CAP },
          {
            $lookup: {
              from: InvoiceModel.collection.name,
              localField: 'invoiceId',
              foreignField: '_id',
              as: '_inv',
            },
          },
          { $addFields: { invoiceNumber: { $arrayElemAt: ['$_inv.invoiceNumber', 0] } } },
          { $project: { _inv: 0 } },
        ];
        return PaymentRecordModel.aggregate(pipeline) as Promise<Record<string, unknown>[]>;
      },
      'Payment report',
      'payments',
      'payments-report',
      async (rows) =>
        enrichRowsWithLookups(rows, {
          branchIdKey: 'branchId',
          studentIdKey: 'studentId',
          userIdKeys: ['receivedBy'],
        }),
    );
  }

  exportInvoices(user: AuthenticatedUser, query: ReportExportQuery) {
    assertFinanceReport(user);
    return this.exportRows(
      user,
      query,
      async () => {
        const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
        const { from, to } = resolveDateRange(query);
        match.createdAt = { $gte: from, $lte: to };
        if (query.studentId) match.studentId = oid(query.studentId);
        if (query.invoiceStatus) match.status = query.invoiceStatus;
        else if (query.status) match.status = query.status;
        const sortField = (INVOICE_SORT_FIELDS as readonly string[]).includes(query.sortBy ?? '')
          ? (query.sortBy as InvoiceSortField)
          : 'createdAt';
        const sort: Record<string, 1 | -1> = { [sortField]: query.sortOrder === 'asc' ? 1 : -1 };
        const pipeline: PipelineStage[] = [
          { $match: match },
          { $sort: sort },
          { $limit: EXPORT_ROW_CAP },
          {
            $lookup: {
              from: StudentModel.collection.name,
              localField: 'studentId',
              foreignField: '_id',
              as: '_stu',
            },
          },
          {
            $addFields: {
              studentName: { $arrayElemAt: ['$_stu.fullName', 0] },
              studentCode: { $arrayElemAt: ['$_stu.studentId', 0] },
            },
          },
          { $project: { _stu: 0 } },
        ];
        return InvoiceModel.aggregate(pipeline) as Promise<Record<string, unknown>[]>;
      },
      'Invoice report',
      'invoices',
      'invoices-report',
      async (rows) =>
        enrichRowsWithLookups(rows, {
          branchIdKey: 'branchId',
          studentIdKey: 'studentId',
        }),
    );
  }

  exportSeats(user: AuthenticatedUser, query: ReportExportQuery) {
    assertOperationalReportAllowed(user);
    return this.exportRows(
      user,
      query,
      async () => {
        const match: Record<string, unknown> = { ...buildTenantMatch(user, query), active: true };
        const { from, to } = resolveDateRange(query);
        match.updatedAt = { $gte: from, $lte: to };
        if (query.seatId) match._id = oid(query.seatId);
        if (query.status) match.status = query.status;
        const sort = pickSort(SEAT_SORT, query.sortBy, 'seatNumber', query.sortOrder);
        const pipeline: PipelineStage[] = [
          { $match: match },
          { $sort: sort },
          { $limit: EXPORT_ROW_CAP },
          {
            $lookup: {
              from: StudentModel.collection.name,
              localField: 'assignedStudentId',
              foreignField: '_id',
              as: '_stu',
            },
          },
          {
            $addFields: {
              assignedStudentName: { $arrayElemAt: ['$_stu.fullName', 0] },
              assignedStudentCode: { $arrayElemAt: ['$_stu.studentId', 0] },
            },
          },
          { $project: { _stu: 0 } },
        ];
        return SeatModel.aggregate(pipeline) as Promise<Record<string, unknown>[]>;
      },
      'Seat occupancy report',
      'seats',
      'seats-report',
      async (rows) => enrichRowsWithLookups(rows, { branchIdKey: 'branchId' }),
    );
  }

  exportDues(user: AuthenticatedUser, query: ReportExportQuery) {
    assertFinanceReport(user);
    return this.exportRows(
      user,
      query,
      async () => {
        const match: Record<string, unknown> = { ...buildTenantMatch(user, query) };
        const { from, to } = resolveDateRange(query);
        match.createdAt = { $gte: from, $lte: to };
        match.dueAmount = { $gt: EPS };
        match.status = query.invoiceStatus ?? { $in: ['UNPAID', 'PARTIAL', 'OVERDUE'] };
        if (query.studentId) match.studentId = oid(query.studentId);
        const sortField = (INVOICE_SORT_FIELDS as readonly string[]).includes(query.sortBy ?? '')
          ? (query.sortBy as InvoiceSortField)
          : 'dueDate';
        const sort: Record<string, 1 | -1> = { [sortField]: query.sortOrder === 'asc' ? 1 : -1 };
        const pipeline: PipelineStage[] = [
          { $match: match },
          { $sort: sort },
          { $limit: EXPORT_ROW_CAP },
          {
            $lookup: {
              from: StudentModel.collection.name,
              localField: 'studentId',
              foreignField: '_id',
              as: '_stu',
            },
          },
          {
            $addFields: {
              studentName: { $arrayElemAt: ['$_stu.fullName', 0] },
              studentCode: { $arrayElemAt: ['$_stu.studentId', 0] },
            },
          },
          { $project: { _stu: 0 } },
        ];
        return InvoiceModel.aggregate(pipeline) as Promise<Record<string, unknown>[]>;
      },
      'Dues report',
      'dues',
      'dues-report',
      async (rows) =>
        enrichRowsWithLookups(rows, {
          branchIdKey: 'branchId',
          studentIdKey: 'studentId',
        }),
    );
  }
}

export const reportsService = new ReportsService();
