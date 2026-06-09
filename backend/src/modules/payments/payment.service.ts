import crypto from 'node:crypto';
import type { PipelineStage, SortOrder } from 'mongoose';
import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS, type PermissionName } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { enrichRowsWithLookups, enrichSingleRowWithLookups } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seat.model';
import { logActivity } from '@modules/activity/activity-audit.service';
import { membershipService } from '@modules/membership/membership.service';
import {
  applyPartialPlanOnMembership,
  resolveDowngradeOnInvoicePayment,
} from '@modules/membership/membership-partial.service';
import {
  assertMinimumPartialPayment,
  getMinimumStartAmount,
  parseLibraryMembershipSettings,
  resolvePartialPlanConfig,
} from '@modules/membership/partial-plan.util';
import { DOWNGRADE_STATUS } from '@modules/membership/membership.constants';
import { MembershipModel } from '@modules/membership/membership.model';

import { FeePlanModel, InvoiceModel, PaymentRecordModel, RefundModel } from './payments.models';
import {
  type InvoiceStatus,
  type PaymentRecordStatus,
} from './payment.constants';
import type {
  CollectPaymentInput,
  CreateFeePlanInput,
  CreateInvoiceInput,
  FeePlanListQuery,
  InvoiceListQuery,
  PaymentListQuery,
  PaymentSummaryQuery,
  RefundInput,
  UpdateFeePlanInput,
  UpdateInvoiceInput,
} from './payment.validation';

const EPS = 0.009;

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotalAmount(amount: number, discount: number, tax: number): number {
  return roundMoney(Math.max(0, amount - discount + tax));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireLibraryContext(user: AuthenticatedUser): string {
  if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
  return user.libraryId;
}

async function assertBranchInLibrary(branchId: string, libraryId: Types.ObjectId): Promise<void> {
  const branch = await BranchModel.findOne({
    _id: new Types.ObjectId(branchId),
    libraryId,
  }).lean();
  if (!branch) throw ApiError.badRequest('Branch not found for this library');
}

/**
 * Validates that the resolved branch belongs to the caller's tenant (or super-admin selection).
 * `claimedLibraryId` is required for SUPER_ADMIN and must match the branch document.
 */
function assertBranchWriteScope(
  user: AuthenticatedUser,
  branch: { _id: Types.ObjectId; libraryId: Types.ObjectId },
  claimedLibraryId: string | undefined,
  branchMismatchMessage: string,
): void {
  const libId = branch.libraryId as Types.ObjectId;
  if (user.role === ROLES.SUPER_ADMIN) {
    if (!claimedLibraryId) {
      throw ApiError.badRequest('libraryId is required for platform operators');
    }
    if (String(libId) !== String(claimedLibraryId)) {
      throw ApiError.badRequest('Branch does not belong to the selected library');
    }
    return;
  }
  requireLibraryContext(user);
  if (user.libraryId !== String(libId)) {
    throw ApiError.forbidden('Branch is not part of your library');
  }
  if (user.branchId && user.branchId !== String(branch._id)) {
    throw ApiError.forbidden(branchMismatchMessage);
  }
}

/** Tenant row filter for payment entities (non–super-admin). */
function tenantFilterForUser(
  user: AuthenticatedUser,
  opts: { libraryId?: string; branchId?: string },
): Record<string, unknown> {
  if (user.role === ROLES.SUPER_ADMIN) {
    const f: Record<string, unknown> = {};
    if (opts.libraryId) f.libraryId = new Types.ObjectId(opts.libraryId);
    if (opts.branchId) f.branchId = new Types.ObjectId(opts.branchId);
    return f;
  }
  const lib = requireLibraryContext(user);
  const f: Record<string, unknown> = { libraryId: new Types.ObjectId(lib) };
  if (user.branchId) {
    f.branchId = new Types.ObjectId(user.branchId);
  } else if (opts.branchId) {
    f.branchId = new Types.ObjectId(opts.branchId);
  }
  return f;
}

async function resolveStudentIdForStudentUser(user: AuthenticatedUser): Promise<Types.ObjectId> {
  if (user.role !== ROLES.STUDENT) throw ApiError.internal('Student context only');
  const row = await StudentModel.findOne({ userId: new Types.ObjectId(user.id) })
    .select('_id')
    .lean();
  if (!row) throw ApiError.notFound('Student profile not linked');
  return row._id as Types.ObjectId;
}

async function loadStudentForInvoice(
  studentId: string,
  libraryId: Types.ObjectId,
  branchId: Types.ObjectId,
): Promise<{ _id: Types.ObjectId; branchId: Types.ObjectId }> {
  const student = await StudentModel.findOne({
    _id: new Types.ObjectId(studentId),
    libraryId,
    branchId,
  })
    .select('_id branchId')
    .lean();
  if (!student) throw ApiError.badRequest('Student not found for this library and branch');
  return student as { _id: Types.ObjectId; branchId: Types.ObjectId };
}

function assertCan(user: AuthenticatedUser, ...perms: PermissionName[]): void {
  if (user.role === ROLES.SUPER_ADMIN) return;
  for (const p of perms) {
    if (!user.permissions.includes(p)) throw ApiError.forbidden('Insufficient permissions');
  }
}

function assertCanAny(user: AuthenticatedUser, ...perms: PermissionName[]): void {
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (!perms.some((p) => user.permissions.includes(p))) {
    throw ApiError.forbidden('Insufficient permissions');
  }
}

export function deriveInvoiceStatus(params: {
  status: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: Date;
  refundTotal: number;
  now?: Date;
}): InvoiceStatus {
  const now = params.now ?? new Date();
  if (params.status === 'CANCELLED' || params.status === 'DRAFT') {
    return params.status as InvoiceStatus;
  }

  const due = roundMoney(params.dueAmount);
  const paid = roundMoney(params.paidAmount);
  const total = roundMoney(params.totalAmount);
  const ref = roundMoney(params.refundTotal);

  if (ref > EPS && paid <= EPS && due >= total - EPS) {
    return 'REFUNDED';
  }
  if (due <= EPS && paid >= total - EPS) {
    return 'PAID';
  }
  if (paid > EPS && due > EPS) {
    return 'PARTIAL';
  }

  const overdue = params.dueDate.getTime() < now.getTime();
  if (overdue) return 'OVERDUE';
  return 'UNPAID';
}

async function allocateDocumentNumber(libraryId: Types.ObjectId, prefix: string): Promise<string> {
  for (let i = 0; i < 12; i += 1) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const candidate = `${prefix}-${suffix}`;
    if (prefix === 'INV') {
      if (!(await InvoiceModel.exists({ libraryId, invoiceNumber: candidate }))) return candidate;
    } else if (!(await PaymentRecordModel.exists({ libraryId, receiptNumber: candidate }))) {
      return candidate;
    }
  }
  throw ApiError.internal('Unable to allocate document number');
}

function recalcInvoiceFinancials(inv: {
  amount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  refundTotal: number;
  dueAmount: number;
  dueDate: Date;
  status: string;
}): void {
  inv.totalAmount = computeTotalAmount(inv.amount, inv.discountAmount, inv.taxAmount);
  inv.dueAmount = roundMoney(Math.max(0, inv.totalAmount - inv.paidAmount));
  if (inv.status === 'CANCELLED') return;
  if (inv.status === 'DRAFT') return;
  const next = deriveInvoiceStatus({
    status: inv.status,
    totalAmount: inv.totalAmount,
    paidAmount: inv.paidAmount,
    dueAmount: inv.dueAmount,
    dueDate: inv.dueDate,
    refundTotal: inv.refundTotal,
  });
  inv.status = next;
}

async function listInvoicesWithEnrichment(
  user: AuthenticatedUser,
  query: InvoiceListQuery,
): Promise<{ items: unknown[]; total: number; page: number; limit: number }> {
  assertCanAny(user, PERMISSIONS.PAYMENT_READ);
  const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
  let studentFilter: Types.ObjectId | undefined;
  if (user.role === ROLES.STUDENT) {
    studentFilter = await resolveStudentIdForStudentUser(user);
  }
  const scope = tenantFilterForUser(user, { libraryId: query.libraryId, branchId: query.branchId });
  const match: Record<string, unknown> = { ...scope };
  if (studentFilter) match.studentId = studentFilter;
  if (query.studentId) {
    if (user.role === ROLES.STUDENT) {
      if (query.studentId !== String(studentFilter)) throw ApiError.forbidden('You can only view your invoices');
    } else {
      match.studentId = new Types.ObjectId(query.studentId);
    }
  }
  if (query.invoiceId) match._id = new Types.ObjectId(query.invoiceId);
  if (query.seatId) match.seatId = new Types.ObjectId(query.seatId);

  if (query.status) {
    match.status = query.status;
  } else if (query.overdueOnly) {
    match.status = { $in: ['UNPAID', 'PARTIAL', 'OVERDUE'] };
  } else if (query.hasOpenBalance) {
    match.status = { $nin: ['PAID', 'CANCELLED', 'REFUNDED', 'DRAFT'] };
  }

  if (query.hasOpenBalance || query.overdueOnly) {
    match.dueAmount = { $gt: EPS };
  }
  if (query.downgradePending) {
    match.downgradeIfUnpaid = true;
    match.dueAmount = { $gt: EPS };
    match.downgradeDueDate = { $ne: null };
  }
  if (query.downgraded) {
    const memScope: Record<string, unknown> = {};
    if (scope.libraryId) memScope.libraryId = scope.libraryId;
    if (scope.branchId) memScope.branchId = scope.branchId;
    const downgradedRows = await MembershipModel.find({
      ...memScope,
      downgradeStatus: DOWNGRADE_STATUS.COMPLETED,
      invoiceId: { $ne: null },
    })
      .select('invoiceId')
      .lean();
    const invoiceIds = downgradedRows.map((m) => m.invoiceId).filter(Boolean);
    match._id = { $in: invoiceIds.length ? invoiceIds : [new Types.ObjectId()] };
  }
  const dueDateFilter: Record<string, Date> = {};
  if (query.dueAfter) dueDateFilter.$gte = query.dueAfter;
  if (query.dueBefore) dueDateFilter.$lte = query.dueBefore;
  if (query.overdueOnly) dueDateFilter.$lt = new Date();
  if (Object.keys(dueDateFilter).length > 0) {
    match.dueDate = { ...((match.dueDate as Record<string, Date>) ?? {}), ...dueDateFilter };
  }
  if (user.role !== ROLES.SUPER_ADMIN && query.branchId && !user.branchId && scope.libraryId) {
    await assertBranchInLibrary(query.branchId, scope.libraryId as Types.ObjectId);
  }

  const stuCol = StudentModel.collection.collectionName;
  const brCol = BranchModel.collection.collectionName;
  const seatCol = SeatModel.collection.collectionName;
  const fpCol = FeePlanModel.collection.collectionName;
  const payCol = PaymentRecordModel.collection.collectionName;

  const searchTrim = query.search?.trim();
  const searchRegex = searchTrim ? new RegExp(escapeRegex(searchTrim), 'i') : null;

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: stuCol,
        localField: 'studentId',
        foreignField: '_id',
        as: '_s',
      },
    },
    {
      $lookup: {
        from: brCol,
        localField: 'branchId',
        foreignField: '_id',
        as: '_b',
      },
    },
    {
      $lookup: {
        from: seatCol,
        localField: 'seatId',
        foreignField: '_id',
        as: '_seat',
      },
    },
    {
      $lookup: {
        from: fpCol,
        localField: 'feePlanId',
        foreignField: '_id',
        as: '_fp',
      },
    },
    {
      $lookup: {
        from: payCol,
        let: { invId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$invoiceId', '$$invId'] }, { $eq: ['$status', 'ACTIVE'] }],
              },
            },
          },
          { $sort: { paidAt: -1 } },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: '_lp',
      },
    },
    {
      $addFields: {
        studentDoc: { $arrayElemAt: ['$_s', 0] },
        branchDoc: { $arrayElemAt: ['$_b', 0] },
        seatDoc: { $arrayElemAt: ['$_seat', 0] },
        feePlanDoc: { $arrayElemAt: ['$_fp', 0] },
      },
    },
  ];

  if (searchRegex) {
    pipeline.push({
      $match: {
        $or: [
          { invoiceNumber: searchRegex },
          { 'studentDoc.fullName': searchRegex },
          { 'studentDoc.phone': searchRegex },
          { 'studentDoc.studentId': searchRegex },
          { 'seatDoc.seatNumber': searchRegex },
        ],
      },
    });
  }

  const sortDir: SortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sortKey = query.sortBy ?? 'createdAt';

  pipeline.push(
    {
      $facet: {
        items: [
          { $sort: { [sortKey]: sortDir } },
          { $skip: skip },
          { $limit: limit },
          {
            $addFields: {
              invoiceId: { $toString: '$_id' },
              studentName: { $ifNull: ['$studentDoc.fullName', ''] },
              studentCode: { $ifNull: ['$studentDoc.studentId', ''] },
              studentPhone: { $ifNull: ['$studentDoc.phone', ''] },
              seatNumber: { $ifNull: ['$seatDoc.seatNumber', null] },
              branchName: { $ifNull: ['$branchDoc.branchName', ''] },
              feePlanName: { $ifNull: ['$feePlanDoc.name', null] },
              lastPaymentId: {
                $cond: {
                  if: { $gt: [{ $size: '$_lp' }, 0] },
                  then: { $toString: { $arrayElemAt: ['$_lp._id', 0] } },
                  else: null,
                },
              },
              hasActivePayments: { $gt: ['$paidAmount', EPS] },
            },
          },
          {
            $project: {
              _s: 0,
              _b: 0,
              _seat: 0,
              _fp: 0,
              _lp: 0,
              studentDoc: 0,
              branchDoc: 0,
              seatDoc: 0,
              feePlanDoc: 0,
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  );

  const agg = await InvoiceModel.aggregate(pipeline);
  const row = agg[0] as { items: unknown[]; total: { n: number }[] };
  const rawItems = row?.items ?? [];
  const total = row?.total?.[0]?.n ?? 0;
  const items = await enrichRowsWithLookups(rawItems as Record<string, unknown>[], {
    libraryIdKey: 'libraryId',
  });
  return { items, total, page, limit };
}

class PaymentFinanceService {
  async createFeePlan(user: AuthenticatedUser, input: CreateFeePlanInput) {
    assertCan(user, PERMISSIONS.FEE_PLAN_CREATE);
    const branch = await BranchModel.findById(input.branchId).lean();
    if (!branch) throw ApiError.badRequest('Branch not found');
    assertBranchWriteScope(
      user,
      { _id: branch._id as Types.ObjectId, libraryId: branch.libraryId as Types.ObjectId },
      input.libraryId ?? undefined,
      'You can only manage fee plans for your branch',
    );
    const libraryId = branch.libraryId as Types.ObjectId;
    if (input.shiftId) {
      const { ShiftModel } = await import('@modules/shifts/shift.model');
      const shift = await ShiftModel.findOne({
        _id: new Types.ObjectId(input.shiftId),
        branchId: branch._id,
        libraryId,
      }).lean();
      if (!shift) throw ApiError.badRequest('Shift not found for this branch');
    }

    const doc = await FeePlanModel.create({
      libraryId,
      branchId: branch._id,
      name: input.name,
      type: input.type ?? 'MEMBERSHIP',
      amount: roundMoney(input.amount),
      durationDays: input.durationDays,
      billingDurationMonths: input.billingDurationMonths ?? null,
      shiftId: input.shiftId ? new Types.ObjectId(input.shiftId) : null,
      allowManualPriceOverride: input.allowManualPriceOverride ?? false,
      allowPartialStart: input.allowPartialStart ?? false,
      minimumStartAmountType: input.minimumStartAmountType ?? null,
      minimumStartAmount:
        input.minimumStartAmount != null ? roundMoney(input.minimumStartAmount) : null,
      partialDueDays: input.partialDueDays ?? null,
      downgradeIfUnpaid: input.downgradeIfUnpaid ?? true,
      downgradeDurationDays: input.downgradeDurationDays ?? 30,
      offerLabel: input.offerLabel ?? null,
      description: input.description,
      active: input.active,
    });
    return toJSON(doc.toObject());
  }

  async listFeePlans(user: AuthenticatedUser, query: FeePlanListQuery) {
    assertCanAny(user, PERMISSIONS.FEE_PLAN_READ, PERMISSIONS.PAYMENT_READ, PERMISSIONS.PAYMENT_CREATE);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const scope = tenantFilterForUser(user, { libraryId: query.libraryId, branchId: query.branchId });
    const filter: Record<string, unknown> = { ...scope };
    if (query.active !== undefined) filter.active = query.active;
    if (query.type) filter.type = query.type;
    if (query.search) {
      filter.name = new RegExp(escapeRegex(query.search), 'i');
    }
    if (user.role !== ROLES.SUPER_ADMIN && query.branchId && !user.branchId && scope.libraryId) {
      await assertBranchInLibrary(query.branchId, scope.libraryId as Types.ObjectId);
    }
    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };
    const [items, total] = await Promise.all([
      FeePlanModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      FeePlanModel.countDocuments(filter),
    ]);
    const enriched = await enrichRowsWithLookups(
      items as unknown as Record<string, unknown>[],
      { branchIdKey: 'branchId', libraryIdKey: 'libraryId' },
    );
    return { items: enriched.map((i) => toJSON(i)), meta: { pagination: buildPaginationMeta(total, page, limit) } };
  }

  async updateFeePlan(user: AuthenticatedUser, id: string, input: UpdateFeePlanInput) {
    assertCan(user, PERMISSIONS.FEE_PLAN_UPDATE);
    const plan = await FeePlanModel.findById(id);
    if (!plan) throw ApiError.notFound('Fee plan not found');
    const scope = tenantFilterForUser(user, {});
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      (String(plan.libraryId) !== String(scope.libraryId) ||
        (scope.branchId && String(plan.branchId) !== String(scope.branchId)))
    ) {
      throw ApiError.forbidden('Access denied');
    }
    if (input.name !== undefined) plan.name = input.name;
    if (input.type !== undefined) plan.type = input.type;
    if (input.amount !== undefined) plan.amount = roundMoney(input.amount);
    if (input.durationDays !== undefined) plan.durationDays = input.durationDays;
    if (input.shiftId !== undefined) {
      plan.shiftId = input.shiftId ? new Types.ObjectId(input.shiftId) : null;
    }
    if (input.allowManualPriceOverride !== undefined) {
      plan.allowManualPriceOverride = input.allowManualPriceOverride;
    }
    if (input.billingDurationMonths !== undefined) {
      plan.billingDurationMonths = input.billingDurationMonths;
    }
    if (input.allowPartialStart !== undefined) plan.allowPartialStart = input.allowPartialStart;
    if (input.minimumStartAmountType !== undefined) {
      plan.minimumStartAmountType = input.minimumStartAmountType;
    }
    if (input.minimumStartAmount !== undefined) {
      plan.minimumStartAmount =
        input.minimumStartAmount != null ? roundMoney(input.minimumStartAmount) : null;
    }
    if (input.partialDueDays !== undefined) plan.partialDueDays = input.partialDueDays;
    if (input.downgradeIfUnpaid !== undefined) plan.downgradeIfUnpaid = input.downgradeIfUnpaid;
    if (input.downgradeDurationDays !== undefined) {
      plan.downgradeDurationDays = input.downgradeDurationDays;
    }
    if (input.offerLabel !== undefined) plan.offerLabel = input.offerLabel;
    if (input.description !== undefined) plan.description = input.description;
    if (input.active !== undefined) plan.active = input.active;
    await plan.save();
    return toJSON(plan.toObject());
  }

  async deleteFeePlan(user: AuthenticatedUser, id: string) {
    assertCan(user, PERMISSIONS.FEE_PLAN_DELETE);
    const plan = await FeePlanModel.findById(id);
    if (!plan) throw ApiError.notFound('Fee plan not found');
    const scope = tenantFilterForUser(user, {});
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      (String(plan.libraryId) !== String(scope.libraryId) ||
        (scope.branchId && String(plan.branchId) !== String(scope.branchId)))
    ) {
      throw ApiError.forbidden('Access denied');
    }
    plan.active = false;
    await plan.save();
    return { id: String(plan._id), deactivated: true };
  }

  async createInvoice(user: AuthenticatedUser, input: CreateInvoiceInput) {
    assertCan(user, PERMISSIONS.PAYMENT_CREATE);
    const branch = await BranchModel.findById(input.branchId).lean();
    if (!branch) throw ApiError.badRequest('Branch not found');
    assertBranchWriteScope(
      user,
      { _id: branch._id as Types.ObjectId, libraryId: branch.libraryId as Types.ObjectId },
      input.libraryId ?? undefined,
      'Invoice must be created in your branch',
    );
    const libraryId = branch.libraryId as Types.ObjectId;
    const branchId = branch._id as Types.ObjectId;
    await loadStudentForInvoice(input.studentId, libraryId, branchId);

    let amount = input.amount ?? 0;
    let feePlanId: Types.ObjectId | null = null;
    let partialMeta: Record<string, unknown> = {};
    if (input.feePlanId) {
      const plan = await FeePlanModel.findOne({
        _id: new Types.ObjectId(input.feePlanId),
        libraryId,
        branchId,
        active: true,
      }).lean();
      if (!plan) throw ApiError.badRequest('Fee plan not found or inactive');
      feePlanId = plan._id as Types.ObjectId;
      if (input.amount === undefined) amount = plan.amount;
      const library = await LibraryModel.findById(libraryId).select('settings').lean();
      const partialConfig = resolvePartialPlanConfig(
        plan,
        parseLibraryMembershipSettings((library?.settings as Record<string, unknown>) ?? {}),
      );
      if (partialConfig.allowPartialStart) {
        const invoiceTotalPreview = computeTotalAmount(
          roundMoney(amount),
          roundMoney(input.discountAmount ?? 0),
          roundMoney(input.taxAmount ?? 0),
        );
        partialMeta = {
          partialMinimumAmount: getMinimumStartAmount(plan, invoiceTotalPreview, partialConfig),
          downgradeIfUnpaid: partialConfig.downgradeIfUnpaid,
          downgradeDueDate: input.dueDate,
          selectedDurationDays: plan.durationDays,
          downgradeDurationDays: partialConfig.downgradeDurationDays,
        };
      }
    }

    const totalAmount = computeTotalAmount(
      roundMoney(amount),
      roundMoney(input.discountAmount ?? 0),
      roundMoney(input.taxAmount ?? 0),
    );
    const invoiceNumber = await allocateDocumentNumber(libraryId, 'INV');
    const initialStatus = input.status === 'DRAFT' ? 'DRAFT' : 'UNPAID';

    const inv = await InvoiceModel.create({
      libraryId,
      branchId,
      studentId: new Types.ObjectId(input.studentId),
      seatId: input.seatId ? new Types.ObjectId(input.seatId as string) : null,
      feePlanId,
      invoiceNumber,
      amount: roundMoney(amount),
      discountAmount: roundMoney(input.discountAmount ?? 0),
      taxAmount: roundMoney(input.taxAmount ?? 0),
      totalAmount,
      paidAmount: 0,
      refundTotal: 0,
      dueAmount: totalAmount,
      status: initialStatus,
      dueDate: input.dueDate,
      notes: input.notes,
      membershipPeriodStart: input.membershipPeriodStart ?? null,
      membershipPeriodEnd: input.membershipPeriodEnd ?? null,
      currency: 'INR',
      ...partialMeta,
    });
    recalcInvoiceFinancials(inv);
    await inv.save();
    logActivity({
      actorUserId: user.id,
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: String(inv._id),
      libraryId: String(libraryId),
      branchId: String(branchId),
      metadata: {
        entityLabel: invoiceNumber,
        description: `Invoice ${invoiceNumber} created`,
      },
    });
    return toJSON(inv.toObject());
  }

  async listInvoices(user: AuthenticatedUser, query: InvoiceListQuery) {
    const { items, total, page, limit } = await listInvoicesWithEnrichment(user, query);
    return { items: items.map((i) => toJSON(i)), meta: { pagination: buildPaginationMeta(total, page, limit) } };
  }

  async listDues(user: AuthenticatedUser, query: InvoiceListQuery) {
    return this.listInvoices(user, { ...query, status: undefined, hasOpenBalance: true, overdueOnly: false });
  }

  async listOverdue(user: AuthenticatedUser, query: InvoiceListQuery) {
    assertCanAny(user, PERMISSIONS.PAYMENT_READ);
    const scope = tenantFilterForUser(user, { libraryId: query.libraryId, branchId: query.branchId });
    const now = new Date();
    const markMatch: Record<string, unknown> = {
      ...scope,
      dueDate: { $lt: now },
      dueAmount: { $gt: EPS },
      status: { $in: ['UNPAID', 'PARTIAL'] },
    };
    if (user.role === ROLES.STUDENT) {
      markMatch.studentId = await resolveStudentIdForStudentUser(user);
    }
    await InvoiceModel.updateMany(markMatch, { $set: { status: 'OVERDUE' } });
    return this.listInvoices(user, { ...query, status: undefined, overdueOnly: true, hasOpenBalance: false });
  }

  async getInvoice(user: AuthenticatedUser, id: string) {
    assertCanAny(user, PERMISSIONS.PAYMENT_READ);
    const inv = await InvoiceModel.findById(id);
    if (!inv) throw ApiError.notFound('Invoice not found');
    const scope = tenantFilterForUser(user, {});
    if (user.role === ROLES.STUDENT) {
      const sid = await resolveStudentIdForStudentUser(user);
      if (String(inv.studentId) !== String(sid)) throw ApiError.forbidden('Access denied');
    } else if (user.role !== ROLES.SUPER_ADMIN) {
      if (String(inv.libraryId) !== String(scope.libraryId)) throw ApiError.forbidden('Access denied');
      if (scope.branchId && String(inv.branchId) !== String(scope.branchId)) {
        throw ApiError.forbidden('Access denied');
      }
    }
    recalcInvoiceFinancials(inv);
    await inv.save();
    const enriched = await enrichSingleRowWithLookups(toJSON(inv.toObject()) as Record<string, unknown>, {
      studentIdKey: 'studentId',
      branchIdKey: 'branchId',
      seatIdKey: 'seatId',
    });
    return enriched;
  }

  async updateInvoice(user: AuthenticatedUser, id: string, input: UpdateInvoiceInput) {
    assertCan(user, PERMISSIONS.PAYMENT_UPDATE);
    const inv = await InvoiceModel.findById(id);
    if (!inv) throw ApiError.notFound('Invoice not found');
    const scope = tenantFilterForUser(user, {});
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      (String(inv.libraryId) !== String(scope.libraryId) ||
        (scope.branchId && String(inv.branchId) !== String(scope.branchId)))
    ) {
      throw ApiError.forbidden('Access denied');
    }
    if (['CANCELLED', 'REFUNDED'].includes(inv.status)) {
      throw ApiError.conflict('Invoice cannot be edited in this state');
    }
    if (inv.status === 'DRAFT' || inv.paidAmount <= EPS) {
      if (input.discountAmount !== undefined) inv.discountAmount = roundMoney(input.discountAmount);
      if (input.taxAmount !== undefined) inv.taxAmount = roundMoney(input.taxAmount);
    } else if (input.discountAmount !== undefined || input.taxAmount !== undefined) {
      throw ApiError.conflict('Cannot change tax/discount after payments are recorded');
    }
    if (input.dueDate) inv.dueDate = input.dueDate;
    if (input.notes !== undefined) inv.notes = input.notes;
    if (input.seatId !== undefined) {
      inv.seatId =
        input.seatId === null || input.seatId === ''
          ? null
          : new Types.ObjectId(input.seatId as string);
    }
    if (input.membershipPeriodStart !== undefined) inv.membershipPeriodStart = input.membershipPeriodStart;
    if (input.membershipPeriodEnd !== undefined) inv.membershipPeriodEnd = input.membershipPeriodEnd;
    if (input.status) {
      if (input.status === 'CANCELLED' && inv.paidAmount > EPS) {
        throw ApiError.conflict('Cancel only allowed when no payments applied');
      }
      inv.status = input.status;
    }
    recalcInvoiceFinancials(inv);
    await inv.save();
    return toJSON(inv.toObject());
  }

  async collectPayment(user: AuthenticatedUser, input: CollectPaymentInput) {
    assertCan(user, PERMISSIONS.PAYMENT_CREATE);
    if (input.allowOverpayment) assertCan(user, PERMISSIONS.PAYMENT_UPDATE);
    const inv = await InvoiceModel.findById(input.invoiceId);
    if (!inv) throw ApiError.notFound('Invoice not found');
    const scope = tenantFilterForUser(user, {});
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      (String(inv.libraryId) !== String(scope.libraryId) ||
        (scope.branchId && String(inv.branchId) !== String(scope.branchId)))
    ) {
      throw ApiError.forbidden('Access denied');
    }
    if (inv.status === 'CANCELLED') throw ApiError.conflict('Cancelled invoice cannot receive payments');
    if (inv.status === 'DRAFT') throw ApiError.conflict('Issue the invoice before collecting payment');
    if (inv.status === 'REFUNDED') {
      throw ApiError.conflict('Invoice is fully refunded');
    }

    recalcInvoiceFinancials(inv);
    const due = roundMoney(inv.dueAmount);
    const payAmt = roundMoney(input.amount);
    if (!input.allowOverpayment && payAmt > due + EPS) {
      throw ApiError.badRequest('Payment exceeds due amount');
    }

    if (payAmt > EPS && inv.feePlanId) {
      const plan = await FeePlanModel.findById(inv.feePlanId).lean();
      if (plan) {
        const library = await LibraryModel.findById(inv.libraryId).select('settings').lean();
        const partialConfig = resolvePartialPlanConfig(
          plan,
          parseLibraryMembershipSettings((library?.settings as Record<string, unknown>) ?? {}),
        );
        if (partialConfig.allowPartialStart) {
          const minimumRequired = getMinimumStartAmount(plan, roundMoney(inv.totalAmount), partialConfig);
          assertMinimumPartialPayment({
            allowPartialStart: true,
            minimumRequired,
            paymentAmount: payAmt,
            invoiceTotal: roundMoney(inv.totalAmount),
            alreadyPaidAmount: roundMoney(inv.paidAmount),
          });
        }
      }
    }

    const receiptNumber = await allocateDocumentNumber(inv.libraryId as Types.ObjectId, 'RCP');
    const paidAt = input.paidAt ?? new Date();
    const pay = await PaymentRecordModel.create({
      libraryId: inv.libraryId,
      branchId: inv.branchId,
      studentId: inv.studentId,
      invoiceId: inv._id,
      amount: payAmt,
      method: input.method,
      transactionId: input.transactionId,
      receiptNumber,
      receivedBy: new Types.ObjectId(user.id),
      paidAt,
      notes: input.notes,
      status: 'ACTIVE' as PaymentRecordStatus,
      refundedAmount: 0,
    });

    inv.paidAmount = roundMoney(inv.paidAmount + payAmt);
    inv.dueAmount = roundMoney(Math.max(0, inv.totalAmount - inv.paidAmount));
    recalcInvoiceFinancials(inv);
    await inv.save();
    logActivity({
      actorUserId: user.id,
      action: 'PAYMENT_COLLECTED',
      entityType: 'PAYMENT',
      entityId: String(pay._id),
      libraryId: String(inv.libraryId),
      branchId: String(inv.branchId),
      metadata: {
        entityLabel: receiptNumber,
        description: `Payment ${receiptNumber} collected`,
      },
    });

    let durationDays = 0;
    if (inv.membershipPeriodStart && inv.membershipPeriodEnd) {
      const ms = inv.membershipPeriodEnd.getTime() - inv.membershipPeriodStart.getTime();
      durationDays = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    }
    if (!durationDays && inv.feePlanId) {
      const plan = await FeePlanModel.findById(inv.feePlanId).lean();
      durationDays = plan?.durationDays ?? 30;
    }
    if (!durationDays) durationDays = 30;

    if (inv.studentId && payAmt > 0 && !input.skipMembershipExtension) {
      await membershipService.extendFromPayment({
        studentId: inv.studentId as Types.ObjectId,
        libraryId: inv.libraryId as Types.ObjectId,
        branchId: inv.branchId as Types.ObjectId,
        invoiceId: inv._id as Types.ObjectId,
        paymentId: pay._id as Types.ObjectId,
        durationDays,
        feePlanId: inv.feePlanId as Types.ObjectId | null,
        seatId: inv.seatId as Types.ObjectId | null,
      });
    }

    if (inv.feePlanId) {
      const plan = await FeePlanModel.findById(inv.feePlanId).lean();
      if (plan?.allowPartialStart) {
        const library = await LibraryModel.findById(inv.libraryId).select('settings').lean();
        const config = resolvePartialPlanConfig(
          plan,
          parseLibraryMembershipSettings((library?.settings as Record<string, unknown>) ?? {}),
        );
        const membership = await MembershipModel.findOne({ invoiceId: inv._id })
          .sort({ createdAt: -1 })
          .lean();
        if (membership) {
          const downgradeDue =
            inv.downgradeDueDate ??
            (() => {
              const d = new Date();
              d.setDate(d.getDate() + config.partialDueDays);
              return d;
            })();
          await applyPartialPlanOnMembership({
            membershipId: membership._id as Types.ObjectId,
            feePlan: plan,
            config,
            invoiceAmount: roundMoney(inv.totalAmount),
            paidAmount: roundMoney(inv.paidAmount),
            startDate: new Date(membership.startDate),
            selectedDurationDays: plan.durationDays,
            invoiceId: inv._id as Types.ObjectId,
            downgradeDueDate: downgradeDue,
          });
        }
      }
    }

    await resolveDowngradeOnInvoicePayment(inv._id);
    const refreshedInv = await InvoiceModel.findById(inv._id);
    if (refreshedInv) {
      recalcInvoiceFinancials(refreshedInv);
      await refreshedInv.save();
    }

    return {
      payment: toJSON(pay.toObject()),
      invoice: toJSON((refreshedInv ?? inv).toObject()),
    };
  }

  async listPayments(user: AuthenticatedUser, query: PaymentListQuery) {
    assertCanAny(user, PERMISSIONS.PAYMENT_READ);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const scope = tenantFilterForUser(user, { libraryId: query.libraryId, branchId: query.branchId });
    const filter: Record<string, unknown> = { ...scope, status: 'ACTIVE' };
    if (user.role === ROLES.STUDENT) {
      filter.studentId = await resolveStudentIdForStudentUser(user);
    }
    if (query.studentId && user.role !== ROLES.STUDENT) {
      filter.studentId = new Types.ObjectId(query.studentId);
    }
    if (query.invoiceId) filter.invoiceId = new Types.ObjectId(query.invoiceId);
    if (query.method) filter.method = query.method;
    if (query.from || query.to) {
      filter.paidAt = {} as Record<string, Date>;
      if (query.from) (filter.paidAt as Record<string, Date>).$gte = query.from;
      if (query.to) (filter.paidAt as Record<string, Date>).$lte = query.to;
    }
    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };
    const [items, total] = await Promise.all([
      PaymentRecordModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      PaymentRecordModel.countDocuments(filter),
    ]);
    const enriched = await enrichRowsWithLookups(
      items as unknown as Record<string, unknown>[],
      {
        studentIdKey: 'studentId',
        branchIdKey: 'branchId',
        userIdKeys: ['receivedBy'],
      },
    );
    const invoiceIds = Array.from(
      new Set(
        enriched
          .map((row) => (row.invoiceId ? String(row.invoiceId) : ''))
          .filter((id) => id && Types.ObjectId.isValid(id)),
      ),
    ).map((id) => new Types.ObjectId(id));
    const invoiceMap = new Map<string, string>();
    if (invoiceIds.length) {
      const invoices = await InvoiceModel.find({ _id: { $in: invoiceIds } }).select('invoiceNumber').lean();
      for (const invoice of invoices) {
        invoiceMap.set(String(invoice._id), String(invoice.invoiceNumber));
      }
    }
    const withInvoiceNumber = enriched.map((row) => ({
      ...row,
      invoiceNumber: invoiceMap.get(String(row.invoiceId)) ?? null,
    }));
    return {
      items: withInvoiceNumber.map((i) => toJSON(i)),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getReceipt(user: AuthenticatedUser, paymentId: string) {
    assertCanAny(user, PERMISSIONS.PAYMENT_READ);
    const pay = await PaymentRecordModel.findById(paymentId).lean();
    if (!pay) throw ApiError.notFound('Payment not found');
    if (user.role === ROLES.STUDENT) {
      const sid = await resolveStudentIdForStudentUser(user);
      if (String(pay.studentId) !== String(sid)) throw ApiError.forbidden('Access denied');
    } else {
      const scope = tenantFilterForUser(user, {});
      if (
        user.role !== ROLES.SUPER_ADMIN &&
        (String(pay.libraryId) !== String(scope.libraryId) ||
          (scope.branchId && String(pay.branchId) !== String(scope.branchId)))
      ) {
        throw ApiError.forbidden('Access denied');
      }
    }
    const [invoice, student] = await Promise.all([
      InvoiceModel.findById(pay.invoiceId).lean(),
      StudentModel.findById(pay.studentId).select('fullName studentId email').lean(),
    ]);
    return { payment: toJSON(pay), invoice: invoice ? toJSON(invoice) : null, student: student ? toJSON(student) : null };
  }

  async refundPayment(user: AuthenticatedUser, input: RefundInput) {
    assertCan(user, PERMISSIONS.PAYMENT_REFUND);
    const pay = await PaymentRecordModel.findById(input.paymentId);
    if (!pay) throw ApiError.notFound('Payment not found');
    const scope = tenantFilterForUser(user, {});
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      (String(pay.libraryId) !== String(scope.libraryId) ||
        (scope.branchId && String(pay.branchId) !== String(scope.branchId)))
    ) {
      throw ApiError.forbidden('Access denied');
    }
    if (pay.status !== 'ACTIVE') throw ApiError.conflict('Cannot refund a voided payment');

    const inv = await InvoiceModel.findById(pay.invoiceId);
    if (!inv) throw ApiError.notFound('Invoice not found');

    if (roundMoney(input.amount) > roundMoney(inv.paidAmount) + EPS) {
      throw ApiError.badRequest('Refund exceeds amount applied to invoice');
    }

    const refundable = roundMoney(pay.amount - pay.refundedAmount);
    if (roundMoney(input.amount) > refundable + EPS) {
      throw ApiError.badRequest('Refund exceeds remaining payment amount');
    }

    await RefundModel.create({
      libraryId: pay.libraryId,
      branchId: pay.branchId,
      studentId: pay.studentId,
      invoiceId: pay.invoiceId,
      paymentId: pay._id,
      amount: roundMoney(input.amount),
      reason: input.reason,
      refundedBy: new Types.ObjectId(user.id),
      refundedAt: new Date(),
      notes: input.notes,
      status: 'COMPLETED',
    });

    pay.refundedAmount = roundMoney(pay.refundedAmount + roundMoney(input.amount));
    await pay.save();

    inv.paidAmount = roundMoney(inv.paidAmount - roundMoney(input.amount));
    inv.refundTotal = roundMoney(inv.refundTotal + roundMoney(input.amount));
    inv.dueAmount = roundMoney(Math.max(0, inv.totalAmount - inv.paidAmount));
    recalcInvoiceFinancials(inv);
    await inv.save();

    return { refund: true, invoice: toJSON(inv.toObject()), payment: toJSON(pay.toObject()) };
  }

  async voidPayment(user: AuthenticatedUser, paymentId: string) {
    assertCan(user, PERMISSIONS.PAYMENT_DELETE);
    const pay = await PaymentRecordModel.findById(paymentId);
    if (!pay) throw ApiError.notFound('Payment not found');
    const scope = tenantFilterForUser(user, {});
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      (String(pay.libraryId) !== String(scope.libraryId) ||
        (scope.branchId && String(pay.branchId) !== String(scope.branchId)))
    ) {
      throw ApiError.forbidden('Access denied');
    }
    if (pay.status !== 'ACTIVE') throw ApiError.conflict('Payment already voided');
    if (pay.refundedAmount > EPS) throw ApiError.conflict('Void not allowed after refunds');

    const inv = await InvoiceModel.findById(pay.invoiceId);
    if (!inv) throw ApiError.notFound('Invoice not found');

    const amt = roundMoney(pay.amount);
    pay.status = 'VOIDED';
    await pay.save();

    inv.paidAmount = roundMoney(inv.paidAmount - amt);
    inv.dueAmount = roundMoney(Math.max(0, inv.totalAmount - inv.paidAmount));
    recalcInvoiceFinancials(inv);
    await inv.save();
    return { voided: true, invoice: toJSON(inv.toObject()) };
  }

  /**
   * Lightweight snapshot for student summary cards (no list payloads).
   * Reuses the same tenant + row access rules as {@link studentHistory}.
   */
  async getStudentPaymentSnapshot(
    user: AuthenticatedUser,
    studentId: string,
  ): Promise<{
    outstandingAmount: number;
    currency: string;
    lastPaymentAt: string | null;
    openInvoiceCount: number;
  }> {
    assertCanAny(user, PERMISSIONS.PAYMENT_READ);
    if (user.role === ROLES.STUDENT) {
      const sid = await resolveStudentIdForStudentUser(user);
      if (studentId !== String(sid)) throw ApiError.forbidden('Access denied');
    }
    const student = await StudentModel.findById(studentId).lean();
    if (!student) throw ApiError.notFound('Student not found');
    const scope = tenantFilterForUser(user, {});
    if (user.role !== ROLES.SUPER_ADMIN) {
      if (String(student.libraryId) !== String(scope.libraryId)) throw ApiError.forbidden('Access denied');
      if (scope.branchId && String(student.branchId) !== String(scope.branchId)) {
        throw ApiError.forbidden('Access denied');
      }
    }

    const sid = student._id as Types.ObjectId;

    const [agg, lastPay] = await Promise.all([
      InvoiceModel.aggregate<{ _id: null; totalDue: number; count: number }>([
        {
          $match: {
            studentId: sid,
            dueAmount: { $gt: EPS },
            status: { $nin: ['CANCELLED', 'DRAFT', 'REFUNDED', 'PAID'] },
          },
        },
        {
          $group: {
            _id: null,
            totalDue: { $sum: '$dueAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      PaymentRecordModel.findOne({ studentId: sid, status: 'ACTIVE' })
        .sort({ paidAt: -1 })
        .select('paidAt')
        .lean(),
    ]);

    const row = agg[0];
    return {
      outstandingAmount: roundMoney(row?.totalDue ?? 0),
      currency: 'INR',
      lastPaymentAt: lastPay?.paidAt ? new Date(lastPay.paidAt).toISOString() : null,
      openInvoiceCount: row?.count ?? 0,
    };
  }

  async studentHistory(user: AuthenticatedUser, studentId: string) {
    assertCanAny(user, PERMISSIONS.PAYMENT_READ);
    if (user.role === ROLES.STUDENT) {
      const sid = await resolveStudentIdForStudentUser(user);
      if (studentId !== String(sid)) throw ApiError.forbidden('Access denied');
    }
    const student = await StudentModel.findById(studentId).lean();
    if (!student) throw ApiError.notFound('Student not found');
    const scope = tenantFilterForUser(user, {});
    if (user.role !== ROLES.SUPER_ADMIN) {
      if (String(student.libraryId) !== String(scope.libraryId)) throw ApiError.forbidden('Access denied');
      if (scope.branchId && String(student.branchId) !== String(scope.branchId)) {
        throw ApiError.forbidden('Access denied');
      }
    }

    const [invoices, payments] = await Promise.all([
      InvoiceModel.find({ studentId: student._id }).sort({ createdAt: -1 }).limit(50).lean(),
      PaymentRecordModel.find({ studentId: student._id, status: 'ACTIVE' })
        .sort({ paidAt: -1 })
        .limit(50)
        .lean(),
    ]);
    return {
      student: toJSON(student),
      invoices: invoices.map((i) => toJSON(i)),
      payments: payments.map((p) => toJSON(p)),
    };
  }

  async summary(user: AuthenticatedUser, query: PaymentSummaryQuery) {
    assertCan(user, PERMISSIONS.PAYMENT_SUMMARY);
    const scope = tenantFilterForUser(user, { libraryId: query.libraryId, branchId: query.branchId });
    if (user.role !== ROLES.SUPER_ADMIN && query.branchId && !user.branchId && scope.libraryId) {
      await assertBranchInLibrary(query.branchId, scope.libraryId as Types.ObjectId);
    }
    const match: Record<string, unknown> = {
      ...scope,
      status: 'ACTIVE',
      paidAt: { $gte: query.from, $lte: query.to },
    };

    const groupId =
      query.granularity === 'month'
        ? {
            y: { $year: '$paidAt' },
            m: { $month: '$paidAt' },
            branchId: '$branchId',
          }
        : {
            y: { $year: '$paidAt' },
            m: { $month: '$paidAt' },
            d: { $dayOfMonth: '$paidAt' },
            branchId: '$branchId',
          };

    const rows = await PaymentRecordModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: groupId,
          totalCollected: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
    ]);

    const byBranch = await PaymentRecordModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$branchId',
          totalCollected: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);
    const enrichedBranches = await enrichRowsWithLookups(
      byBranch.map((row) => ({
        _id: row._id,
        branchId: row._id,
        totalCollected: row.totalCollected,
        count: row.count,
      })) as Record<string, unknown>[],
      { branchIdKey: 'branchId' },
    );

    return {
      period: { from: query.from, to: query.to, granularity: query.granularity },
      series: rows.map((r) => toJSON(r)),
      byBranch: enrichedBranches.map((row) => toJSON(row)),
    };
  }

  async getStudentPortalWallet(user: AuthenticatedUser) {
    if (user.role !== ROLES.STUDENT) throw ApiError.forbidden('Student account required');
    const studentId = await resolveStudentIdForStudentUser(user);
    const [invoices, payments] = await Promise.all([
      InvoiceModel.find({ studentId }).sort({ dueDate: 1 }).limit(100).lean(),
      PaymentRecordModel.find({ studentId, status: 'ACTIVE' }).sort({ paidAt: -1 }).limit(100).lean(),
    ]);
    const outstanding = invoices
      .filter((i) => !['CANCELLED', 'DRAFT', 'PAID', 'REFUNDED'].includes(i.status))
      .reduce((s, i) => s + roundMoney(i.dueAmount), 0);
    const totalPaid = payments.reduce((s, p) => s + roundMoney(p.amount), 0);
    return {
      studentId: String(studentId),
      currency: 'INR',
      outstandingAmount: roundMoney(outstanding),
      totalPaid: roundMoney(totalPaid),
      invoices: invoices.map((i) => toJSON(i)),
      payments: payments.map((p) => toJSON(p)),
    };
  }
}

export const paymentService = new PaymentFinanceService();

export const __paymentTestables = {
  roundMoney,
  computeTotalAmount,
  deriveInvoiceStatus,
  tenantFilterForUser,
};
