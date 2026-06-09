import crypto from 'node:crypto';

import type { SortOrder } from 'mongoose';
import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import {
  LIBRARY_STATUS,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seats.models';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { normalizePlanKey } from '@modules/platform/platform-catalog-plan.util';
import {
  loadCatalogPlansById,
  resolveSubscriptionPlanFromCatalogMap,
} from './subscription-plan-resolve.util';
import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';

import { insertInAppNotifications } from '@modules/notifications/channels/in-app.notification.service';

import { PlatformSubscriptionInvoiceModel } from './platform-subscription-invoice.model';
import { BILLING_CYCLE } from './subscription-billing.constants';
import {
  PLATFORM_SUBSCRIPTION_INVOICE_STATUS,
  SUBSCRIPTION_UI_STATUS,
} from './subscription-billing.constants';
import {
  computeRenewalPeriodStart,
  computeSubscriptionPeriod,
  deriveOpenInvoiceStatus,
  endOfDay,
  escapeRegex,
  roundMoney,
  startOfDay,
} from './subscription-billing.helpers';
import { SUBSCRIPTION_PAYMENT_METHOD_VALUES } from './subscription-billing.constants';
import type {
  CancelPlatformSubscriptionInvoiceBody,
  CollectPlatformSubscriptionInvoiceBody,
  CreatePlatformSubscriptionInvoiceBody,
  PlatformSubscriptionInvoiceListQuery,
} from './subscription-billing.validation';
import {
  notifySubscriptionInvoiceCreated,
  notifySubscriptionInvoicePayment,
  loadPlatformContactEmails,
} from './subscription-billing.notify';
import {
  buildLibrarySubscriptionPayload,
  EXPIRY_STATE,
  type ExpiryState,
} from './subscription-lifecycle.util';
import { librarySubscriptionService } from './library-subscription.service';
import { subscriptionFeatureService } from './subscription-feature.service';
import { LibrarySubscriptionModel } from './library-subscription.model';
import { SUBSCRIPTION_EVENT_TYPE } from './library-subscription.constants';

function expiryStateToUiStatus(
  state: ExpiryState,
): (typeof SUBSCRIPTION_UI_STATUS)[keyof typeof SUBSCRIPTION_UI_STATUS] {
  const map: Record<ExpiryState, (typeof SUBSCRIPTION_UI_STATUS)[keyof typeof SUBSCRIPTION_UI_STATUS]> = {
    [EXPIRY_STATE.ACTIVE]: SUBSCRIPTION_UI_STATUS.ACTIVE,
    [EXPIRY_STATE.TRIAL]: SUBSCRIPTION_UI_STATUS.TRIAL,
    [EXPIRY_STATE.EXPIRING_SOON]: SUBSCRIPTION_UI_STATUS.EXPIRING_SOON,
    [EXPIRY_STATE.EXPIRED]: SUBSCRIPTION_UI_STATUS.EXPIRED,
    [EXPIRY_STATE.GRACE_PERIOD]: SUBSCRIPTION_UI_STATUS.GRACE_PERIOD,
    [EXPIRY_STATE.OVERDUE]: SUBSCRIPTION_UI_STATUS.OVERDUE,
    [EXPIRY_STATE.SUSPENDED]: SUBSCRIPTION_UI_STATUS.SUSPENDED,
    [EXPIRY_STATE.CANCELLED]: SUBSCRIPTION_UI_STATUS.CANCELLED,
  };
  return map[state] ?? SUBSCRIPTION_UI_STATUS.ACTIVE;
}

const assertSuperAdmin = (user: AuthenticatedUser): void => {
  if (user.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Super admin access required');
};

const assertLibraryOwnerBilling = (user: AuthenticatedUser): void => {
  if (user.role !== ROLES.LIBRARY_OWNER || !user.libraryId) {
    throw ApiError.forbidden('Library owner access required');
  }
};

async function allocateInvoiceNumber(): Promise<string> {
  for (let i = 0; i < 8; i += 1) {
    const num = `PSI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const clash = await PlatformSubscriptionInvoiceModel.exists({ invoiceNumber: num });
    if (!clash) return num;
  }
  throw ApiError.internal('Unable to allocate invoice number');
}

async function countStaffUsers(libraryId: Types.ObjectId): Promise<number> {
  const stuRole = await RoleModel.findOne({ name: ROLES.STUDENT }).select('_id').lean();
  if (!stuRole) return 0;
  return UserModel.countDocuments({
    libraryId,
    isActive: true,
    role: { $ne: stuRole._id },
  });
}

function planPriceForCycle(
  plan: { monthlyPrice: number; yearlyPrice: number },
  cycle: string,
): number {
  if (cycle === BILLING_CYCLE.MONTHLY) return roundMoney(plan.monthlyPrice);
  if (cycle === BILLING_CYCLE.YEARLY) return roundMoney(plan.yearlyPrice);
  return roundMoney(Math.max(plan.monthlyPrice, plan.yearlyPrice));
}

function toInvoiceJson(doc: {
  _id: Types.ObjectId;
  libraryId: Types.ObjectId;
  planId: Types.ObjectId;
  planCode: string;
  planName: string;
  billingCycle: string;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  issueDate: Date;
  dueDate: Date;
  subscriptionStartDate: Date;
  subscriptionEndDate: Date;
  paidAt: Date | null;
  paymentMethod: string | null;
  transactionId: string | null;
  notes: string | null;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(doc._id),
    libraryId: String(doc.libraryId),
    planId: String(doc.planId),
    planCode: doc.planCode,
    planName: doc.planName,
    billingCycle: doc.billingCycle,
    invoiceNumber: doc.invoiceNumber,
    amount: doc.amount,
    paidAmount: doc.paidAmount,
    dueAmount: doc.dueAmount,
    status: doc.status,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    subscriptionStartDate: doc.subscriptionStartDate,
    subscriptionEndDate: doc.subscriptionEndDate,
    paidAt: doc.paidAt,
    paymentMethod: doc.paymentMethod,
    transactionId: doc.transactionId,
    notes: doc.notes,
    createdBy: doc.createdBy ? String(doc.createdBy) : null,
    updatedBy: doc.updatedBy ? String(doc.updatedBy) : null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** Applies invoice payment state to LibrarySubscription (source of truth) and syncs Library. */
export async function applyPaidSubscriptionToLibrary(
  libraryId: Types.ObjectId,
  invoice: {
    _id: Types.ObjectId;
    planId: Types.ObjectId;
    planCode: string;
    planName: string;
    billingCycle: string;
    amount: number;
    paidAmount: number;
    dueAmount: number;
    status: string;
    subscriptionStartDate: Date;
    subscriptionEndDate: Date;
  },
  actorUserId: string | null = null,
): Promise<void> {
  await librarySubscriptionService.applyInvoiceToSubscription(libraryId, invoice, actorUserId);
}

export class SubscriptionBillingService {
  async createPlatformInvoice(actor: AuthenticatedUser, body: CreatePlatformSubscriptionInvoiceBody) {
    assertSuperAdmin(actor);
    const lib = await LibraryModel.findById(body.libraryId);
    if (!lib) throw ApiError.notFound('Library not found');

    const plan = await PlatformSubscriptionPlanModel.findById(body.planId).lean();
    if (!plan) throw ApiError.notFound('Subscription plan not found');
    if (!plan.active) throw ApiError.badRequest('Plan is inactive');

    if (body.paymentMethod && !SUBSCRIPTION_PAYMENT_METHOD_VALUES.includes(body.paymentMethod)) {
      throw ApiError.unprocessable('Invalid payment method', { paymentMethod: body.paymentMethod });
    }

    const expectedPrice = planPriceForCycle(plan, body.billingCycle);
    let amount =
      body.amount !== undefined && body.amount !== null && (body.amountOverride || body.billingCycle === BILLING_CYCLE.CUSTOM)
        ? roundMoney(body.amount)
        : expectedPrice;

    if (amount <= 0 && body.billingCycle !== BILLING_CYCLE.CUSTOM) {
      throw ApiError.unprocessable('Amount must be positive for this billing cycle');
    }

    if (
      !body.amountOverride &&
      body.billingCycle !== BILLING_CYCLE.CUSTOM &&
      Math.abs(amount - expectedPrice) > 0.02
    ) {
      throw ApiError.unprocessable(
        `Amount must match plan ${body.billingCycle.toLowerCase()} price (${expectedPrice}) or enable amount override`,
        { expected: expectedPrice, received: amount },
      );
    }

    let subscriptionStartDate: Date;
    let subscriptionEndDate: Date;

    if (body.subscriptionStartDate && body.subscriptionEndDate) {
      subscriptionStartDate = startOfDay(body.subscriptionStartDate);
      subscriptionEndDate = endOfDay(body.subscriptionEndDate);
    } else {
      const startBase =
        body.subscriptionStartDate ??
        computeRenewalPeriodStart(
          {
            status: lib.status,
            subscriptionEndsAt: lib.subscriptionEndsAt,
            trialEndsAt: lib.trialEndsAt,
          },
          {
            startAfterTrial: body.startPaidAfterTrial ?? true,
            startPaidNow: body.startPaidNow ?? false,
          },
        );
      const period = computeSubscriptionPeriod(
        startBase,
        body.billingCycle,
        body.subscriptionEndDate,
      );
      subscriptionStartDate = period.subscriptionStartDate;
      subscriptionEndDate = period.subscriptionEndDate;
    }

    if (subscriptionEndDate.getTime() <= subscriptionStartDate.getTime()) {
      throw ApiError.unprocessable('Subscription end date must be after start date');
    }

    if (body.dueDate.getTime() < body.issueDate.getTime()) {
      throw ApiError.unprocessable('Due date must be on or after issue date');
    }

    let paidAmount = roundMoney(body.paidAmount ?? 0);
    if (!body.allowOverpayment && paidAmount > amount) {
      throw ApiError.unprocessable('Paid amount cannot exceed invoice amount');
    }
    if (body.allowOverpayment) {
      paidAmount = roundMoney(paidAmount);
    } else if (paidAmount > amount) {
      paidAmount = amount;
    }
    const dueAmount = roundMoney(Math.max(0, amount - paidAmount));

    const status = deriveOpenInvoiceStatus({
      amount,
      paidAmount,
      dueDate: body.dueDate,
    });

    const invoiceNumber = await allocateInvoiceNumber();

    const doc = await PlatformSubscriptionInvoiceModel.create({
      libraryId: lib._id,
      planId: plan._id,
      planCode: plan.planKey,
      planName: plan.displayName,
      billingCycle: body.billingCycle,
      invoiceNumber,
      amount,
      paidAmount,
      dueAmount,
      status,
      issueDate: body.issueDate,
      dueDate: body.dueDate,
      subscriptionStartDate,
      subscriptionEndDate,
      paidAt: status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID ? new Date() : null,
      paymentMethod: body.paymentMethod?.trim() || null,
      transactionId: body.transactionId?.trim() || null,
      notes: body.notes?.trim() || null,
      createdBy: new Types.ObjectId(actor.id),
      updatedBy: new Types.ObjectId(actor.id),
    });

    if (
      status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID ||
      status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL
    ) {
      await applyPaidSubscriptionToLibrary(
        lib._id as Types.ObjectId,
        {
          _id: doc._id as Types.ObjectId,
          planId: plan._id as Types.ObjectId,
          planCode: plan.planKey,
          planName: plan.displayName,
          billingCycle: body.billingCycle,
          amount,
          paidAmount,
          dueAmount,
          status,
          subscriptionStartDate,
          subscriptionEndDate,
        },
        actor.id,
      );
    }

    await librarySubscriptionService.recordEvent({
      libraryId: lib._id as Types.ObjectId,
      type: SUBSCRIPTION_EVENT_TYPE.INVOICE_CREATED,
      title: `Invoice ${doc.invoiceNumber} created`,
      metadata: { invoiceId: String(doc._id), status, amount },
      actorUserId: actor.id,
    });

    const owner = lib.ownerId ? await UserModel.findById(lib.ownerId).select('email').lean() : null;
    if (lib.ownerId) {
      await notifySubscriptionInvoiceCreated({
        libraryId: lib._id,
        ownerId: lib.ownerId as Types.ObjectId,
        invoice: {
          invoiceNumber: doc.invoiceNumber,
          amount: doc.amount,
          dueDate: doc.dueDate,
          planName: doc.planName,
        },
        ownerEmail: owner?.email ?? null,
      });
    }

    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: 'SUBSCRIPTION_INVOICE_CREATE',
      entityType: 'PLATFORM_SUBSCRIPTION_INVOICE',
      entityId: String(doc._id),
      libraryId: String(lib._id),
      metadata: { invoiceNumber: doc.invoiceNumber, amount },
      ipAddress: null,
      userAgent: null,
    });

    const fresh = await PlatformSubscriptionInvoiceModel.findById(doc._id).lean();
    return toInvoiceJson(fresh!);
  }

  async listPlatformInvoices(actor: AuthenticatedUser, query: PlatformSubscriptionInvoiceListQuery) {
    assertSuperAdmin(actor);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};

    if (query.libraryId) filter.libraryId = new Types.ObjectId(query.libraryId);
    if (query.planId) filter.planId = new Types.ObjectId(query.planId);
    if (query.billingCycle) filter.billingCycle = query.billingCycle;
    if (query.overdueOnly) {
      filter.status = PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE;
      filter.dueAmount = { $gt: 0 };
    } else if (query.status) {
      filter.status = query.status;
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      const rx = new RegExp(escapeRegex(q), 'i');
      if (query.libraryId) {
        const libOid = new Types.ObjectId(query.libraryId);
        const invMatch = await PlatformSubscriptionInvoiceModel.exists({
          libraryId: libOid,
          $or: [{ invoiceNumber: rx }, { planName: rx }, { planCode: rx }],
        });
        if (!invMatch) {
          return { items: [], meta: { pagination: buildPaginationMeta(0, page, limit) } };
        }
        filter.libraryId = libOid;
        filter.$or = [{ invoiceNumber: rx }, { planName: rx }, { planCode: rx }];
      } else {
        const libs = await LibraryModel.find({ $or: [{ name: rx }, { slug: rx }, { email: rx }] })
          .select('_id')
          .lean();
        const byNumber = await PlatformSubscriptionInvoiceModel.find({ invoiceNumber: rx })
          .select('libraryId')
          .lean();
        const ids = new Set<string>();
        for (const l of libs) ids.add(String(l._id));
        for (const row of byNumber) ids.add(String(row.libraryId));
        if (ids.size === 0) {
          return { items: [], meta: { pagination: buildPaginationMeta(0, page, limit) } };
        }
        filter.libraryId = { $in: [...ids].map((id) => new Types.ObjectId(id)) };
      }
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [rows, total] = await Promise.all([
      PlatformSubscriptionInvoiceModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      PlatformSubscriptionInvoiceModel.countDocuments(filter),
    ]);

    const libIds = [...new Set(rows.map((r) => String(r.libraryId)))];
    const libMap = new Map<string, string>();
    if (libIds.length) {
      const libs = await LibraryModel.find({ _id: { $in: libIds.map((id) => new Types.ObjectId(id)) } })
        .select('name')
        .lean();
      for (const l of libs) libMap.set(String(l._id), l.name);
    }

    return {
      items: rows.map((r) => ({
        ...toInvoiceJson(r as never),
        libraryName: libMap.get(String(r.libraryId)) ?? '',
      })),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getPlatformInvoice(actor: AuthenticatedUser, invoiceId: string) {
    assertSuperAdmin(actor);
    const doc = await PlatformSubscriptionInvoiceModel.findById(invoiceId).lean();
    if (!doc) throw ApiError.notFound('Invoice not found');
    const lib = await LibraryModel.findById(doc.libraryId).select('name').lean();
    return { ...toInvoiceJson(doc as never), libraryName: lib?.name ?? '' };
  }

  async collectPlatformInvoice(
    actor: AuthenticatedUser,
    invoiceId: string,
    body: CollectPlatformSubscriptionInvoiceBody,
  ) {
    assertSuperAdmin(actor);
    const inv = await PlatformSubscriptionInvoiceModel.findById(invoiceId);
    if (!inv) throw ApiError.notFound('Invoice not found');
    if (inv.status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.CANCELLED) {
      throw ApiError.badRequest('Invoice is cancelled');
    }

    const maxPay = roundMoney(inv.amount - inv.paidAmount);
    if (maxPay <= 0) throw ApiError.badRequest('Invoice is already paid');
    const applied = roundMoney(Math.min(body.amount, maxPay));
    if (applied <= 0) throw ApiError.badRequest('Invalid payment amount');

    inv.paidAmount = roundMoney(inv.paidAmount + applied);
    inv.dueAmount = roundMoney(inv.amount - inv.paidAmount);
    inv.status = deriveOpenInvoiceStatus({
      amount: inv.amount,
      paidAmount: inv.paidAmount,
      dueDate: inv.dueDate,
    });
    if (body.paymentMethod?.trim()) inv.paymentMethod = body.paymentMethod.trim();
    if (body.transactionId?.trim()) inv.transactionId = body.transactionId.trim();
    if (body.notes?.trim()) {
      inv.notes = inv.notes ? `${inv.notes}\n${body.notes.trim()}` : body.notes.trim();
    }
    inv.paidAt = new Date();
    inv.updatedBy = new Types.ObjectId(actor.id);
    await inv.save();

    if (
      inv.status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID ||
      inv.status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL
    ) {
      await applyPaidSubscriptionToLibrary(
        inv.libraryId as Types.ObjectId,
        {
          _id: inv._id as Types.ObjectId,
          planId: inv.planId as Types.ObjectId,
          planCode: inv.planCode,
          planName: inv.planName,
          billingCycle: inv.billingCycle,
          amount: inv.amount,
          paidAmount: inv.paidAmount,
          dueAmount: inv.dueAmount,
          status: inv.status,
          subscriptionStartDate: inv.subscriptionStartDate,
          subscriptionEndDate: inv.subscriptionEndDate,
        },
        actor.id,
      );
    }

    const lib = await LibraryModel.findById(inv.libraryId);
    const owner = lib?.ownerId ? await UserModel.findById(lib.ownerId).select('email').lean() : null;
    if (lib?.ownerId) {
      await notifySubscriptionInvoicePayment({
        libraryId: inv.libraryId as Types.ObjectId,
        ownerId: lib.ownerId as Types.ObjectId,
        invoiceNumber: inv.invoiceNumber,
        collectedAmount: applied,
        remainingDue: inv.dueAmount,
        ownerEmail: owner?.email ?? null,
      });
    }

    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: 'SUBSCRIPTION_INVOICE_COLLECT',
      entityType: 'PLATFORM_SUBSCRIPTION_INVOICE',
      entityId: String(inv._id),
      libraryId: String(inv.libraryId),
      metadata: { applied, status: inv.status },
      ipAddress: null,
      userAgent: null,
    });

    const fresh = await PlatformSubscriptionInvoiceModel.findById(inv._id).lean();
    return toInvoiceJson(fresh!);
  }

  async cancelPlatformInvoice(
    actor: AuthenticatedUser,
    invoiceId: string,
    body: CancelPlatformSubscriptionInvoiceBody,
  ) {
    assertSuperAdmin(actor);
    const inv = await PlatformSubscriptionInvoiceModel.findById(invoiceId);
    if (!inv) throw ApiError.notFound('Invoice not found');
    if (inv.status === PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID) {
      throw ApiError.badRequest('Cannot cancel a paid invoice');
    }
    inv.status = PLATFORM_SUBSCRIPTION_INVOICE_STATUS.CANCELLED;
    inv.dueAmount = 0;
    if (body.notes?.trim()) {
      inv.notes = inv.notes ? `${inv.notes}\nCancelled: ${body.notes.trim()}` : `Cancelled: ${body.notes.trim()}`;
    }
    inv.updatedBy = new Types.ObjectId(actor.id);
    await inv.save();

    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: 'SUBSCRIPTION_INVOICE_CANCEL',
      entityType: 'PLATFORM_SUBSCRIPTION_INVOICE',
      entityId: String(inv._id),
      libraryId: String(inv.libraryId),
      metadata: {},
      ipAddress: null,
      userAgent: null,
    });

    const fresh = await PlatformSubscriptionInvoiceModel.findById(inv._id).lean();
    return toInvoiceJson(fresh!);
  }

  async listOwnerInvoices(
    actor: AuthenticatedUser,
    query: { page?: number; limit?: number; status?: string },
  ) {
    assertLibraryOwnerBilling(actor);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = { libraryId: new Types.ObjectId(actor.libraryId!) };
    if (query.status) filter.status = query.status;

    const [rows, total] = await Promise.all([
      PlatformSubscriptionInvoiceModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PlatformSubscriptionInvoiceModel.countDocuments(filter),
    ]);

    return {
      items: rows.map((r) => toInvoiceJson(r as never)),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getOwnerInvoice(actor: AuthenticatedUser, invoiceId: string) {
    assertLibraryOwnerBilling(actor);
    const doc = await PlatformSubscriptionInvoiceModel.findById(invoiceId).lean();
    if (!doc) throw ApiError.notFound('Invoice not found');
    if (String(doc.libraryId) !== actor.libraryId) throw ApiError.forbidden('Invoice not found');
    return toInvoiceJson(doc as never);
  }

  /** Effective plan + override flags for any authenticated tenant user with a library. */
  async getTenantEffectiveFeatures(actor: AuthenticatedUser) {
    if (!actor.libraryId) {
      throw ApiError.forbidden('Library context is required');
    }
    const effective = await subscriptionFeatureService.resolveEffectiveFeatures(actor.libraryId);
    return {
      libraryId: effective.libraryId,
      planCode: effective.planCode,
      planName: effective.planName,
      features: effective.features,
      effectiveFeatures: effective.features,
      featureFlags: effective.features,
      featureAccess: {
        planCode: effective.planCode,
        planName: effective.planName,
        planFeatures: effective.planFeatures,
        features: effective.features,
        included: effective.included,
        unavailable: effective.unavailable,
        enabledFeaturesOverride: effective.enabledFeaturesOverride,
        disabledFeaturesOverride: effective.disabledFeaturesOverride,
      },
    };
  }

  async buildOwnerSubscription(actor: AuthenticatedUser) {
    assertLibraryOwnerBilling(actor);
    return this.buildTenantBillingSnapshot(actor.libraryId!);
  }

  async getSubscriptionSnapshot(libraryId: string): Promise<Record<string, unknown>> {
    const { buildLibrarySubscriptionSnapshot } = await import('./subscription-snapshot.builder');
    const snap = await buildLibrarySubscriptionSnapshot(libraryId);
    return {
      ...snap,
      billing: {
        lastInvoiceAmount: snap.financial.currentInvoice?.amount ?? null,
        dueAmountTotal: snap.financial.dueAmountTotal,
        lastPaymentDate: snap.financial.lastPaymentAt,
        lastInvoiceStatus: snap.financial.currentInvoice?.status ?? null,
        currentInvoice: snap.financial.currentInvoice,
      },
      features: snap.featureFlags,
    };
  }

  async buildTenantBillingSnapshot(libraryId: string): Promise<Record<string, unknown>> {
    const { buildLibrarySubscriptionSnapshot } = await import('./subscription-snapshot.builder');
    const snap = await buildLibrarySubscriptionSnapshot(libraryId);
    return {
      ...snap,
      billing: {
        lastInvoiceAmount: snap.financial.currentInvoice?.amount ?? null,
        dueAmountTotal: snap.financial.dueAmountTotal,
        lastPaymentDate: snap.financial.lastPaymentAt,
        lastInvoiceStatus: snap.financial.currentInvoice?.status ?? null,
        currentInvoice: snap.financial.currentInvoice,
      },
      features: snap.featureFlags,
    };
  }

  async markOverdueInvoices(): Promise<void> {
    const now = new Date();
    await PlatformSubscriptionInvoiceModel.updateMany(
      {
        status: { $in: [PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID, PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL] },
        dueDate: { $lt: now },
        dueAmount: { $gt: 0 },
      },
      { $set: { status: PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE } },
    );
  }

  async remindSubscriptionInvoicesDueSoon(): Promise<void> {
    const today = new Date();
    const target = new Date(today);
    target.setDate(target.getDate() + 3);
    const from = startOfDay(target);
    const to = endOfDay(target);

    const invoices = await PlatformSubscriptionInvoiceModel.find({
      dueDate: { $gte: from, $lte: to },
      status: {
        $in: [
          PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID,
          PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL,
          PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
        ],
      },
      dueAmount: { $gt: 0 },
    })
      .select('libraryId invoiceNumber dueAmount dueDate')
      .lean();

    for (const inv of invoices) {
      const lib = await LibraryModel.findById(inv.libraryId).select('ownerId settings name').lean();
      if (!lib?.ownerId) continue;
      const flag = `subInvDueSoon_${String(inv._id)}_${from.toISOString().slice(0, 10)}`;
      const settings = (lib.settings ?? {}) as Record<string, unknown>;
      if (settings[flag]) continue;

      await insertInAppNotifications([
        {
          libraryId: inv.libraryId as Types.ObjectId,
          branchId: null,
          recipientUserId: lib.ownerId as Types.ObjectId,
          recipientRole: ROLES.LIBRARY_OWNER,
          recipientType: 'USER',
          title: 'Subscription invoice due soon',
          message: `${lib.name}: invoice ${inv.invoiceNumber} due on ${new Date(inv.dueDate).toDateString()} (₹${inv.dueAmount}).`,
          type: 'BILLING',
          channel: 'IN_APP',
          status: 'SENT',
          sentAt: new Date(),
          metadata: { subscriptionInvoiceId: String(inv._id) },
          createdBy: null,
        },
      ]);

      await LibraryModel.updateOne({ _id: lib._id }, { $set: { [`settings.${flag}`]: true } });
    }
  }

  async enrichLibrariesWithSubscription<T extends Record<string, unknown>>(
    items: T[],
  ): Promise<Array<T & { subscription: ReturnType<typeof buildLibrarySubscriptionPayload> }>> {
    if (items.length === 0) return [];

    const ids = items.map((l) => new Types.ObjectId(String((l as { _id?: string })._id ?? (l as { id?: string }).id)));
    const [dueRows, lastInvRows, overdueLibs, plans, lastPaidRows] = await Promise.all([
      PlatformSubscriptionInvoiceModel.aggregate<{ _id: Types.ObjectId; t: number }>([
        {
          $match: {
            libraryId: { $in: ids },
            status: {
              $nin: [
                PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID,
                PLATFORM_SUBSCRIPTION_INVOICE_STATUS.CANCELLED,
              ],
            },
          },
        },
        { $group: { _id: '$libraryId', t: { $sum: '$dueAmount' } } },
      ]),
      PlatformSubscriptionInvoiceModel.aggregate([
        {
          $match: {
            libraryId: { $in: ids },
            status: {
              $in: [
                PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID,
                PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL,
                PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
              ],
            },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$libraryId',
            doc: { $first: '$$ROOT' },
          },
        },
      ]),
      PlatformSubscriptionInvoiceModel.find({
        libraryId: { $in: ids },
        status: PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE,
        dueAmount: { $gt: 0 },
      })
        .select('libraryId')
        .lean(),
      PlatformSubscriptionPlanModel.find().select('planKey displayName').lean(),
      PlatformSubscriptionInvoiceModel.aggregate([
        { $match: { libraryId: { $in: ids }, paidAt: { $ne: null } } },
        { $sort: { paidAt: -1 } },
        { $group: { _id: '$libraryId', paidAt: { $first: '$paidAt' } } },
      ]),
    ]);

    const dueMap = new Map(dueRows.map((r) => [String(r._id), roundMoney(r.t)]));
    const openInvMap = new Map(
      lastInvRows.map((r) => [String(r._id), r.doc as Record<string, unknown>]),
    );
    const overdueSet = new Set(overdueLibs.map((r) => String(r.libraryId)));
    const paidMap = new Map(lastPaidRows.map((r) => [String(r._id), r.paidAt as Date]));
    const catalogByCode = new Map(
      plans.map((p) => [normalizePlanKey(p.planKey), p]),
    );

    const subRecords = await LibrarySubscriptionModel.find({ libraryId: { $in: ids } }).lean();
    const subMap = new Map(subRecords.map((s) => [String(s.libraryId), s]));
    const catalogById = await loadCatalogPlansById(
      subRecords.map((s) => s.planId).filter(Boolean) as Types.ObjectId[],
    );

    return items.map((raw) => {
      const id = String((raw as { _id?: string })._id ?? (raw as { id?: string }).id);
      const subRec = subMap.get(id);
      const inv = openInvMap.get(id);
      const isTrial =
        subRec?.status === 'TRIALING' ||
        subRec?.billingCycle === 'TRIAL' ||
        String(raw.status) === LIBRARY_STATUS.TRIAL;

      const resolved = resolveSubscriptionPlanFromCatalogMap({
        planId: subRec?.planId ?? null,
        planCode: subRec?.planCode ?? String(raw.subscriptionPlan),
        planName: subRec?.planName ?? null,
        catalogById,
        catalogByCode,
      });

      const subscription = buildLibrarySubscriptionPayload({
        lib: {
          status: isTrial ? LIBRARY_STATUS.TRIAL : String(raw.status),
          subscriptionPlan: resolved.code,
          subscriptionStatus: subRec?.status ?? String((raw as { subscriptionStatus?: string }).subscriptionStatus ?? ''),
          trialEndsAt: subRec?.trialEndsAt ?? (raw as { trialEndsAt?: Date | null }).trialEndsAt ?? null,
          subscriptionEndsAt: isTrial
            ? null
            : subRec?.endDate ?? (raw as { subscriptionEndsAt?: Date | null }).subscriptionEndsAt ?? null,
          subscriptionStartsAt:
            subRec?.startDate ?? (raw as { subscriptionStartsAt?: Date | null }).subscriptionStartsAt ?? null,
          billingCycle: subRec?.billingCycle ?? (raw as { billingCycle?: string | null }).billingCycle ?? null,
          graceEndsAt: subRec?.graceEndsAt ?? null,
        },
        planDisplayNameFromCatalog: resolved.displayName,
        openDueTotal: subRec?.dueAmount ? roundMoney(subRec.dueAmount) : (dueMap.get(id) ?? 0),
        lastInvoice: inv as never,
        lastPaymentAt: paidMap.get(id) ?? null,
        hasOverdueInvoice: overdueSet.has(id),
      });

      const planName = isTrial ? subscription.planName : resolved.displayName;

      return {
        ...raw,
        subscription: {
          ...subscription,
          planCode: resolved.code,
          planName,
        },
        plan: {
          id: resolved.planId,
          code: resolved.code,
          displayName: planName,
        },
      };
    });
  }

  async suspendLibrariesPastSubscriptionGrace(): Promise<void> {
    const graceMs = 2 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - graceMs);

    const libs = await LibraryModel.find({
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionEndsAt: { $ne: null, $lt: cutoff },
    })
      .select('_id name subscriptionEndsAt')
      .lean();

    for (const lib of libs) {
      await LibraryModel.updateOne(
        { _id: lib._id, status: LIBRARY_STATUS.ACTIVE },
        {
          $set: {
            status: LIBRARY_STATUS.SUSPENDED,
            suspendedAt: new Date(),
            suspensionReason: 'Subscription period ended — renewal required.',
            subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
          },
        },
      );
    }
  }
}

export const subscriptionBillingService = new SubscriptionBillingService();
