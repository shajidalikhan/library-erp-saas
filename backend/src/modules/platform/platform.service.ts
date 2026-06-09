import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { enrichRowsWithLookups } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import {
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seats.models';
import { InvoiceModel } from '@modules/payments/invoice.model';
import { PaymentRecordModel } from '@modules/payments/payments.models';
import { notificationsService } from '@modules/notifications/notifications.service';

import { AuditLogModel } from './audit-log.model';
import { PlatformSettingModel } from './platform-setting.model';
import { PlatformSubscriptionPlanModel } from './platform-subscription-plan.model';
import { TenantUsageSnapshotModel } from './tenant-usage-snapshot.model';
import { appendPlatformAuditLog } from './platform-audit.service';
import {
  countLibrariesUsingPlan,
  formatCatalogPlanDto,
  isValidPlanKey,
  normalizePlanKey,
  planKeyRegex,
  propagatePlanMetadataChange,
  repairPlanKeyCasing,
  sanitizePlanKey,
} from './platform-catalog-plan.util';
import { subscriptionBillingService } from '@modules/subscription-billing/subscription-billing.service';
import { defaultPlanFeatureFlags } from '@modules/subscription-billing/subscription-feature-catalog';
import type {
  AuditLogsQuery,
  CreateSubscriptionPlanBody,
  PatchPlatformSettingsBody,
  PatchSubscriptionPlanBody,
  PatchTenantBody,
  PlatformAnnouncementBody,
  SuspendTenantBody,
  TenantsListQuery,
} from './platform.validation';

function requireSuper(user: AuthenticatedUser): void {
  if (user.role !== ROLES.SUPER_ADMIN) throw ApiError.forbidden('Super admin access required');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function planFlags(overrides: Partial<Record<string, boolean>>): Record<string, boolean> {
  const base = defaultPlanFeatureFlags();
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'boolean') base[key] = value;
  }
  return base;
}

const DEFAULT_PLANS: Array<{
  planKey: string;
  displayName: string;
  description: string;
  perfectFor: string;
  highlights: string[];
  maxStudents: number;
  maxBranches: number;
  maxSeats: number;
  maxStaff: number;
  storageLimitMb: number;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  mostPopular: boolean;
  publicVisible: boolean;
  trialDays: number;
  sortOrder: number;
  featureFlags: Record<string, boolean>;
}> = [
  {
    planKey: SUBSCRIPTION_PLAN.BASIC,
    displayName: 'Basic',
    description: '14-day trial, no card required · full-access demo',
    perfectFor: 'Small reading rooms and single-branch operators.',
    highlights: [
      '50 seats · 1 branch · 5 staff',
      '1 GB optimized cloud storage',
      'Attendance & QR attendance',
      'Payments · invoices · core reports',
    ],
    maxStudents: 100,
    maxBranches: 1,
    maxSeats: 50,
    maxStaff: 5,
    storageLimitMb: 1024,
    monthlyPrice: 499,
    yearlyPrice: 4999,
    currency: 'INR',
    mostPopular: false,
    publicVisible: true,
    trialDays: 14,
    sortOrder: 0,
    featureFlags: planFlags({
      multi_branch: false,
      exports: false,
      analytics: false,
      qr_attendance: false,
      payment_reminders: false,
      whatsapp: false,
      sms: false,
      student_portal: false,
      audit_logs: false,
      api_access: false,
      automation_jobs: false,
      custom_branding: false,
      white_label: false,
    }),
  },
  {
    planKey: SUBSCRIPTION_PLAN.GROWTH,
    displayName: 'Growth',
    description: 'Most teams land here once exports and reminders matter.',
    perfectFor: 'Growing libraries coordinating multiple branches.',
    highlights: [
      '150 seats · 3 branches',
      'Analytics · exports · reminders · notifications',
      'Role-permission depth',
      'Operational seats & attendance workflows',
    ],
    maxStudents: 300,
    maxBranches: 3,
    maxSeats: 150,
    maxStaff: 15,
    storageLimitMb: 3072,
    monthlyPrice: 1499,
    yearlyPrice: 14999,
    currency: 'INR',
    mostPopular: true,
    publicVisible: true,
    trialDays: 14,
    sortOrder: 1,
    featureFlags: planFlags({
      multi_branch: true,
      exports: true,
      analytics: true,
      qr_attendance: true,
      payment_reminders: true,
      branch_analytics: true,
      public_booking: true,
    }),
  },
  {
    planKey: SUBSCRIPTION_PLAN.PROFESSIONAL,
    displayName: 'Professional',
    description: 'Automation, integrations, and compliance-friendly exports.',
    perfectFor: 'Multi-branch hubs and regional operators.',
    highlights: [
      '500 seats · 10 branches',
      'WhatsApp · SMS · audit logs · advanced exports',
      'API access & automation jobs where enabled',
      'Higher storage and SLA-friendly limits',
    ],
    maxStudents: 1000,
    maxBranches: 10,
    maxSeats: 500,
    maxStaff: 50,
    storageLimitMb: 10240,
    monthlyPrice: 3999,
    yearlyPrice: 39999,
    currency: 'INR',
    mostPopular: false,
    publicVisible: true,
    trialDays: 14,
    sortOrder: 2,
    featureFlags: planFlags({
      multi_branch: true,
      exports: true,
      analytics: true,
      advanced_attendance_reports: true,
      membership_analytics: true,
      branch_analytics: true,
      qr_attendance: true,
      payment_reminders: true,
      whatsapp: true,
      sms: true,
      student_portal: true,
      audit_logs: true,
      custom_branding: true,
      public_booking: true,
    }),
  },
  {
    planKey: SUBSCRIPTION_PLAN.ENTERPRISE,
    displayName: 'Enterprise',
    description: 'Custom limits, onboarding, SLAs.',
    perfectFor: 'Franchise chains & white-label programs.',
    highlights: ['Unlimited / custom limits', 'White label · custom domains', 'Dedicated platform support'],
    maxStudents: 100_000,
    maxBranches: 500,
    maxSeats: 50_000,
    maxStaff: 500,
    storageLimitMb: 500_000,
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'INR',
    mostPopular: false,
    publicVisible: true,
    trialDays: 14,
    sortOrder: 3,
    featureFlags: planFlags(
      Object.fromEntries(
        Object.keys(defaultPlanFeatureFlags()).map((k) => [k, true]),
      ) as Record<string, boolean>,
    ),
  },
];

/** Seeds default catalog tiers only when missing — never overwrites Super Admin edits. */
async function ensureDefaultSubscriptionPlans(): Promise<void> {
  for (const p of DEFAULT_PLANS) {
    await PlatformSubscriptionPlanModel.updateOne(
      { planKey: p.planKey },
      {
        $setOnInsert: {
          planKey: p.planKey,
          displayName: p.displayName,
          description: p.description,
          perfectFor: p.perfectFor,
          highlights: p.highlights,
          maxStudents: p.maxStudents,
          maxBranches: p.maxBranches,
          maxSeats: p.maxSeats,
          maxStaff: p.maxStaff,
          storageLimitMb: p.storageLimitMb,
          monthlyPrice: p.monthlyPrice,
          yearlyPrice: p.yearlyPrice,
          currency: p.currency,
          featureFlags: p.featureFlags,
          active: true,
          mostPopular: p.mostPopular,
          publicVisible: p.publicVisible,
          trialDays: p.trialDays,
          sortOrder: p.sortOrder,
        },
      },
      { upsert: true },
    );
  }
  await repairPlanKeyCasing();
}

async function getOrCreateSettings() {
  let doc = await PlatformSettingModel.findOne({ singletonKey: 'default' }).lean();
  if (!doc) {
    await PlatformSettingModel.create({
      singletonKey: 'default',
      supportEmail: 'support@example.com',
      salesEmail: '',
      demoRequestNotifyEmail: '',
      supportPhone: '',
      billingPhone: '',
      maintenanceMode: false,
      featureFlags: {},
      impersonationEnabled: false,
      impersonationNotes: '',
    });
    doc = await PlatformSettingModel.findOne({ singletonKey: 'default' }).lean();
  }
  return doc!;
}

class PlatformService {
  async getDashboard(_user: AuthenticatedUser) {
    requireSuper(_user);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const trialWarnHorizon = new Date(now);
    trialWarnHorizon.setDate(trialWarnHorizon.getDate() + 3);
    const activeSince = new Date(now);
    activeSince.setDate(activeSince.getDate() - 30);

    const [
      totalLibraries,
      activeLibraries,
      suspendedLibraries,
      trialLibraries,
      totalStudents,
      monthlyRevenueAgg,
      activeUsers,
      trialsExpiring,
    ] = await Promise.all([
      LibraryModel.countDocuments(),
      LibraryModel.countDocuments({ status: LIBRARY_STATUS.ACTIVE }),
      LibraryModel.countDocuments({ status: LIBRARY_STATUS.SUSPENDED }),
      LibraryModel.countDocuments({ status: LIBRARY_STATUS.TRIAL }),
      StudentModel.countDocuments({}),
      PaymentRecordModel.aggregate<{ total: number }>([
        {
          $match: {
            paidAt: { $gte: monthStart },
            status: 'ACTIVE',
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      UserModel.countDocuments({ isActive: true, lastLoginAt: { $gte: activeSince } }),
      LibraryModel.countDocuments({
        status: LIBRARY_STATUS.TRIAL,
        trialEndsAt: { $gte: now, $lte: trialWarnHorizon },
      }),
    ]);

    const monthlyRevenue = monthlyRevenueAgg[0]?.total ?? 0;

    return {
      totalLibraries,
      activeLibraries,
      suspendedLibraries,
      trialLibraries,
      totalStudents,
      monthlyRevenue,
      activeUsers,
      trialsExpiring,
      generatedAt: now.toISOString(),
    };
  }

  async getHealth(_user: AuthenticatedUser) {
    requireSuper(_user);
    const mongoState = (await import('mongoose')).default.connection.readyState;
    return {
      mongo: mongoState === 1 ? 'connected' : 'disconnected',
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round((process.memoryUsage().rss / 1024 / 1024) * 10) / 10,
      nodeEnv: process.env.NODE_ENV ?? 'development',
    };
  }

  async getSettings(user: AuthenticatedUser) {
    requireSuper(user);
    const s = await getOrCreateSettings();
    return {
      supportEmail: s.supportEmail,
      salesEmail: s.salesEmail ?? '',
      demoRequestNotifyEmail: s.demoRequestNotifyEmail ?? '',
      supportPhone: s.supportPhone ?? '',
      billingPhone: s.billingPhone ?? '',
      whatsappSupport: s.whatsappSupport ?? '',
      showSupportEmail: s.showSupportEmail !== false,
      showSupportPhone: s.showSupportPhone !== false,
      showWhatsappSupport: Boolean(s.showWhatsappSupport),
      showSalesEmail: s.showSalesEmail !== false,
      maintenanceMode: s.maintenanceMode,
      featureFlags: s.featureFlags ?? {},
      impersonationEnabled: s.impersonationEnabled,
      impersonationNotes: s.impersonationNotes,
      updatedAt: s.updatedAt,
    };
  }

  async patchSettings(user: AuthenticatedUser, body: PatchPlatformSettingsBody) {
    requireSuper(user);
    await getOrCreateSettings();
    const updated = await PlatformSettingModel.findOneAndUpdate(
      { singletonKey: 'default' },
      {
        $set: {
          ...(body.supportEmail !== undefined ? { supportEmail: body.supportEmail } : {}),
          ...(body.salesEmail !== undefined ? { salesEmail: body.salesEmail } : {}),
          ...(body.demoRequestNotifyEmail !== undefined
            ? { demoRequestNotifyEmail: body.demoRequestNotifyEmail }
            : {}),
          ...(body.supportPhone !== undefined ? { supportPhone: body.supportPhone } : {}),
          ...(body.billingPhone !== undefined ? { billingPhone: body.billingPhone } : {}),
          ...(body.whatsappSupport !== undefined ? { whatsappSupport: body.whatsappSupport } : {}),
          ...(body.showSupportEmail !== undefined ? { showSupportEmail: body.showSupportEmail } : {}),
          ...(body.showSupportPhone !== undefined ? { showSupportPhone: body.showSupportPhone } : {}),
          ...(body.showWhatsappSupport !== undefined ? { showWhatsappSupport: body.showWhatsappSupport } : {}),
          ...(body.showSalesEmail !== undefined ? { showSalesEmail: body.showSalesEmail } : {}),
          ...(body.maintenanceMode !== undefined ? { maintenanceMode: body.maintenanceMode } : {}),
          ...(body.featureFlags !== undefined ? { featureFlags: body.featureFlags } : {}),
          ...(body.impersonationNotes !== undefined ? { impersonationNotes: body.impersonationNotes } : {}),
        },
      },
      { new: true },
    )
      .lean();
    await appendPlatformAuditLog({
      actorUserId: user.id,
      action: 'PLATFORM_SETTINGS_UPDATE',
      entityType: 'PLATFORM_SETTING',
      entityId: String(updated?._id ?? ''),
      metadata: { patch: body },
      ipAddress: null,
      userAgent: null,
    });
    return this.getSettings(user);
  }

  async listTenants(user: AuthenticatedUser, query: TenantsListQuery) {
    requireSuper(user);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.subscriptionPlan) filter.subscriptionPlan = query.subscriptionPlan;
    if (query.billingCycle) filter.billingCycle = query.billingCycle;

    const warnDays = query.expiringWithinDays ?? 3;
    if (query.expiringWithinDays !== undefined) {
      const now = new Date();
      const horizon = new Date(now);
      horizon.setDate(horizon.getDate() + warnDays);
      filter.$or = [
        { status: LIBRARY_STATUS.TRIAL, trialEndsAt: { $gte: now, $lte: horizon } },
        {
          status: LIBRARY_STATUS.ACTIVE,
          subscriptionEndsAt: { $gte: now, $lte: horizon },
        },
      ];
    }

    if (query.search?.trim()) {
      const rx = new RegExp(query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { slug: rx }, { email: rx }];
    }
    const sort: Record<string, 1 | -1> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };
    const [items, total] = await Promise.all([
      LibraryModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      LibraryModel.countDocuments(filter),
    ]);

    const ownerIds = items.map((l) => l.ownerId).filter(Boolean) as Types.ObjectId[];
    const owners =
      ownerIds.length > 0
        ? await UserModel.find({ _id: { $in: ownerIds } }).select('fullName email').lean()
        : [];
    const ownerMap = new Map(
      owners.map((o) => [String(o._id), { name: o.fullName, email: o.email }]),
    );

    let rows = items.map((l) => ({
      id: String(l._id),
      _id: String(l._id),
      name: l.name,
      slug: l.slug,
      email: l.email,
      status: l.status,
      subscriptionPlan: l.subscriptionPlan,
      subscriptionStatus: (l as { subscriptionStatus?: string }).subscriptionStatus,
      subscriptionStartsAt: (l as { subscriptionStartsAt?: Date | null }).subscriptionStartsAt ?? null,
      subscriptionEndsAt: (l as { subscriptionEndsAt?: Date | null }).subscriptionEndsAt ?? null,
      trialEndsAt: (l as { trialEndsAt?: Date | null }).trialEndsAt ?? null,
      billingCycle: (l as { billingCycle?: string | null }).billingCycle ?? null,
      suspendedAt: (l as { suspendedAt?: Date | null }).suspendedAt ?? null,
      suspensionReason: (l as { suspensionReason?: string | null }).suspensionReason ?? null,
      ownerId: l.ownerId ? String(l.ownerId) : null,
      ownerName: l.ownerId ? ownerMap.get(String(l.ownerId))?.name ?? null : null,
      ownerEmail: l.ownerId ? ownerMap.get(String(l.ownerId))?.email ?? null : null,
      createdAt: l.createdAt,
    })) as Array<Record<string, unknown>>;

    rows = await subscriptionBillingService.enrichLibrariesWithSubscription(rows);

    if (query.expiryState) {
      rows = rows.filter(
        (r) => (r.subscription as { expiryState?: string })?.expiryState === query.expiryState,
      );
    }

    return {
      items: rows,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getTenant(user: AuthenticatedUser, libraryId: string) {
    requireSuper(user);
    const lib = await LibraryModel.findById(libraryId).lean();
    if (!lib) throw ApiError.notFound('Library not found');

    const [branches, students, seats, invoicesOpen, payments30d, staff] = await Promise.all([
      BranchModel.countDocuments({ libraryId: lib._id }),
      StudentModel.countDocuments({ libraryId: lib._id }),
      SeatModel.countDocuments({ libraryId: lib._id }),
      InvoiceModel.countDocuments({
        libraryId: lib._id,
        status: { $in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
      }),
      (async () => {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const agg = await PaymentRecordModel.aggregate<{ c: number; sum: number }>([
          { $match: { libraryId: lib._id, paidAt: { $gte: since }, status: 'ACTIVE' } },
          { $group: { _id: null, c: { $sum: 1 }, sum: { $sum: '$amount' } } },
        ]);
        return { count: agg[0]?.c ?? 0, amount: agg[0]?.sum ?? 0 };
      })(),
      (async () => {
        const stuRole = await RoleModel.findOne({ name: ROLES.STUDENT }).select('_id').lean();
        if (!stuRole) return 0;
        return UserModel.countDocuments({
          libraryId: lib._id,
          isActive: true,
          role: { $ne: stuRole._id },
        });
      })(),
    ]);

    const billingSnapshot = await subscriptionBillingService.buildTenantBillingSnapshot(libraryId);

    const owner = lib.ownerId
      ? await UserModel.findById(lib.ownerId).select('fullName email').lean()
      : null;

    return {
      library: {
        id: String(lib._id),
        name: lib.name,
        slug: lib.slug,
        email: lib.email,
        status: lib.status,
        subscriptionPlan: lib.subscriptionPlan,
        subscriptionStatus: (lib as { subscriptionStatus?: string }).subscriptionStatus,
        subscriptionStartsAt: (lib as { subscriptionStartsAt?: Date | null }).subscriptionStartsAt ?? null,
        trialEndsAt: (lib as { trialEndsAt?: Date | null }).trialEndsAt ?? null,
        subscriptionEndsAt: (lib as { subscriptionEndsAt?: Date | null }).subscriptionEndsAt ?? null,
        suspendedAt: (lib as { suspendedAt?: Date | null }).suspendedAt ?? null,
        suspensionReason: (lib as { suspensionReason?: string | null }).suspensionReason ?? null,
        ownerId: lib.ownerId ? String(lib.ownerId) : null,
        ownerName: owner?.fullName ?? null,
        ownerEmail: owner?.email ?? null,
        timezone: lib.timezone,
        createdAt: lib.createdAt,
      },
      usage: {
        branches,
        students,
        seats,
        staff,
        invoicesOpen,
        payments30dCount: payments30d.count,
        payments30dAmount: payments30d.amount,
      },
      billingSnapshot,
    };
  }

  async patchTenant(user: AuthenticatedUser, libraryId: string, body: PatchTenantBody) {
    requireSuper(user);
    const lib = await LibraryModel.findById(libraryId);
    if (!lib) throw ApiError.notFound('Library not found');

    const updates: Record<string, unknown> = {};
    if (body.subscriptionPlan !== undefined) updates.subscriptionPlan = body.subscriptionPlan;
    if (body.subscriptionStatus !== undefined) updates.subscriptionStatus = body.subscriptionStatus;
    if (body.trialEndsAt !== undefined) updates.trialEndsAt = body.trialEndsAt;
    if (body.status !== undefined) updates.status = body.status;

    Object.assign(lib, updates);
    await lib.save();

    if (body.subscriptionPlan !== undefined) {
      const { librarySubscriptionService } = await import(
        '@modules/subscription-billing/library-subscription.service'
      );
      await librarySubscriptionService.syncLibraryPlanFromCatalog(
        libraryId,
        body.subscriptionPlan,
        user.id,
      );
    }

    await appendPlatformAuditLog({
      actorUserId: user.id,
      action: 'TENANT_UPDATE',
      entityType: 'LIBRARY',
      entityId: libraryId,
      libraryId,
      metadata: { updates: body },
      ipAddress: null,
      userAgent: null,
    });

    return this.getTenant(user, libraryId);
  }

  async suspendTenant(user: AuthenticatedUser, libraryId: string, body: SuspendTenantBody) {
    requireSuper(user);
    const lib = await LibraryModel.findById(libraryId);
    if (!lib) throw ApiError.notFound('Library not found');
    if (lib.ownerId && String(lib.ownerId) === user.id) {
      throw ApiError.badRequest('You cannot suspend a tenant you personally own as platform user');
    }

    lib.status = LIBRARY_STATUS.SUSPENDED;
    (lib as { suspendedAt?: Date }).suspendedAt = new Date();
    (lib as { suspensionReason?: string }).suspensionReason = body.reason;
    await lib.save();

    await appendPlatformAuditLog({
      actorUserId: user.id,
      action: 'TENANT_SUSPEND',
      entityType: 'LIBRARY',
      entityId: libraryId,
      libraryId,
      metadata: { reason: body.reason },
      ipAddress: null,
      userAgent: null,
    });

    if (lib.ownerId) {
      try {
        await notificationsService.send(user, {
          title: 'Library suspended',
          message: `Your library "${lib.name}" has been suspended. Reason: ${body.reason}`,
          type: 'SYSTEM',
          channel: 'IN_APP',
          includeSelf: false,
          target: { mode: 'USER', userId: String(lib.ownerId) },
          libraryId: String(lib._id),
        });
      } catch {
        // non-fatal if owner cannot receive
      }
    }

    return this.getTenant(user, libraryId);
  }

  async activateTenant(user: AuthenticatedUser, libraryId: string) {
    requireSuper(user);
    const lib = await LibraryModel.findById(libraryId);
    if (!lib) throw ApiError.notFound('Library not found');
    lib.status = LIBRARY_STATUS.ACTIVE;
    (lib as { suspendedAt?: Date | null }).suspendedAt = null;
    (lib as { suspensionReason?: string | null }).suspensionReason = null;
    await lib.save();

    await appendPlatformAuditLog({
      actorUserId: user.id,
      action: 'TENANT_ACTIVATE',
      entityType: 'LIBRARY',
      entityId: libraryId,
      libraryId,
      metadata: {},
      ipAddress: null,
      userAgent: null,
    });

    return this.getTenant(user, libraryId);
  }

  async getPlan(user: AuthenticatedUser, planId: string) {
    requireSuper(user);
    const doc = await PlatformSubscriptionPlanModel.findById(planId).lean();
    if (!doc) throw ApiError.notFound('Plan not found');
    return formatCatalogPlanDto(doc as unknown as Record<string, unknown> & { _id: unknown });
  }

  async listPublicPlans(): Promise<{ items: Record<string, unknown>[] }> {
    await ensureDefaultSubscriptionPlans();
    const items = await PlatformSubscriptionPlanModel.find({ active: true, publicVisible: true })
      .sort({ sortOrder: 1 })
      .lean();
    return {
      items: items.map((p) =>
        formatCatalogPlanDto(p as unknown as Record<string, unknown> & { _id: unknown }),
      ),
    };
  }

  async listPlans(user: AuthenticatedUser) {
    requireSuper(user);
    await ensureDefaultSubscriptionPlans();
    const items = await PlatformSubscriptionPlanModel.find().sort({ sortOrder: 1 }).lean();
    const usageCounts = await Promise.all(
      items.map((p) => countLibrariesUsingPlan(p._id, p.planKey)),
    );
    return {
      items: items.map((p, index) =>
        formatCatalogPlanDto(p as unknown as Record<string, unknown> & { _id: unknown }, {
          librariesUsingPlan: usageCounts[index] ?? 0,
        }),
      ),
    };
  }

  async createPlan(user: AuthenticatedUser, body: CreateSubscriptionPlanBody) {
    requireSuper(user);
    const planKey = sanitizePlanKey(body.planKey);
    if (!isValidPlanKey(planKey)) throw ApiError.badRequest('Invalid plan key format');
    const exists = await PlatformSubscriptionPlanModel.findOne({ planKey: planKeyRegex(planKey) }).lean();
    if (exists) throw ApiError.conflict('Plan key already exists');

    const dupName = await PlatformSubscriptionPlanModel.findOne({
      displayName: new RegExp(`^${escapeRegex(body.displayName.trim())}$`, 'i'),
    }).lean();
    if (dupName) throw ApiError.conflict('Display name already in use');

    const doc = await PlatformSubscriptionPlanModel.create({
      ...body,
      planKey,
      featureFlags: body.featureFlags ?? {},
      active: body.active ?? true,
      sortOrder: body.sortOrder ?? 99,
    });
    await appendPlatformAuditLog({
      actorUserId: user.id,
      action: 'SUBSCRIPTION_PLAN_CREATED',
      entityType: 'SUBSCRIPTION_PLAN',
      entityId: String(doc._id),
      metadata: { planKey: doc.planKey, displayName: doc.displayName },
      ipAddress: null,
      userAgent: null,
    });
    return formatCatalogPlanDto(doc.toObject() as unknown as Record<string, unknown> & { _id: unknown });
  }

  async patchPlan(user: AuthenticatedUser, planId: string, body: PatchSubscriptionPlanBody) {
    requireSuper(user);
    const existing = await PlatformSubscriptionPlanModel.findById(planId);
    if (!existing) throw ApiError.notFound('Plan not found');

    if (body.displayName !== undefined) {
      const dupName = await PlatformSubscriptionPlanModel.findOne({
        _id: { $ne: existing._id },
        displayName: new RegExp(`^${escapeRegex(body.displayName.trim())}$`, 'i'),
      }).lean();
      if (dupName) throw ApiError.conflict('Display name already in use');
    }

    const oldPlanKey = normalizePlanKey(existing.planKey);
    let planKeyChanged = false;

    if (body.planKey !== undefined) {
      const newPlanKey = sanitizePlanKey(body.planKey);
      if (!isValidPlanKey(newPlanKey)) throw ApiError.badRequest('Invalid plan key format');
      if (newPlanKey !== oldPlanKey) {
        const dupKey = await PlatformSubscriptionPlanModel.findOne({
          planKey: planKeyRegex(newPlanKey),
          _id: { $ne: existing._id },
        }).lean();
        if (dupKey) throw ApiError.conflict('Plan key already exists');
        planKeyChanged = true;
      }
    }

    const allowedKeys = [
      'displayName',
      'description',
      'perfectFor',
      'highlights',
      'monthlyPrice',
      'yearlyPrice',
      'currency',
      'maxStudents',
      'maxBranches',
      'maxSeats',
      'maxStaff',
      'storageLimitMb',
      'featureFlags',
      'active',
      'mostPopular',
      'publicVisible',
      'trialDays',
      'sortOrder',
    ] as const satisfies ReadonlyArray<keyof PatchSubscriptionPlanBody>;
    const $set: Record<string, unknown> = {};
    for (const k of allowedKeys) {
      if (k === 'featureFlags') continue;
      if (body[k] !== undefined) $set[k] = body[k];
    }
    if (body.featureFlags !== undefined) {
      const { mergeCatalogFeatureFlags } = await import('./platform-plan-feature-flags.util');
      $set.featureFlags = mergeCatalogFeatureFlags(
        existing.featureFlags as Record<string, boolean>,
        body.featureFlags,
      );
    }
    if (body.planKey !== undefined) {
      const newPlanKey = sanitizePlanKey(body.planKey);
      if (newPlanKey !== oldPlanKey) {
        $set.planKey = newPlanKey;
      }
    }
    if (Object.keys($set).length === 0) throw ApiError.badRequest('No changes to apply');

    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[platform] patchPlan', { planId, body, $set });
    }

    const wasActive = existing.active;
    const doc = await PlatformSubscriptionPlanModel.findByIdAndUpdate(
      planId,
      { $set },
      { returnDocument: 'after' },
    ).lean();
    if (!doc) throw ApiError.notFound('Plan not found');

    const displayNameChanged =
      body.displayName !== undefined &&
      body.displayName.trim() !== String(existing.displayName ?? '').trim();

    if (planKeyChanged || displayNameChanged) {
      await propagatePlanMetadataChange({
        planId: existing._id,
        planKey: normalizePlanKey(doc.planKey),
        displayName: String(doc.displayName),
        previousPlanKey: planKeyChanged ? oldPlanKey : undefined,
      });
    }

    const action = $set.active === false && wasActive ? 'SUBSCRIPTION_PLAN_DEACTIVATED' : 'SUBSCRIPTION_PLAN_UPDATED';
    await appendPlatformAuditLog({
      actorUserId: user.id,
      action,
      entityType: 'SUBSCRIPTION_PLAN',
      entityId: planId,
      metadata: {
        planKey: doc.planKey,
        oldPlanKey: planKeyChanged ? oldPlanKey : undefined,
        newPlanKey: planKeyChanged ? doc.planKey : undefined,
        patch: $set,
        wasActive,
      },
      ipAddress: null,
      userAgent: null,
    });
    return formatCatalogPlanDto(doc as unknown as Record<string, unknown> & { _id: unknown }, {
      librariesUsingPlan: await countLibrariesUsingPlan(existing._id, doc.planKey),
    });
  }

  async listAuditLogs(user: AuthenticatedUser, query: AuditLogsQuery) {
    requireSuper(user);
    const cappedLimit = query.showAll ? Math.min(Number(query.limit) || 100, 200) : query.limit;
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: cappedLimit });
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.libraryId) filter.libraryId = new Types.ObjectId(query.libraryId);
    if (query.branchId) filter.branchId = new Types.ObjectId(query.branchId);
    if (query.actorUserId) filter.actorUserId = new Types.ObjectId(query.actorUserId);
    if (query.module?.trim()) {
      filter['metadata.module'] = query.module.trim();
    }
    if (query.severity) {
      filter['metadata.severity'] = query.severity;
    }
    if (query.from || query.to) {
      filter.createdAt = {} as Record<string, Date>;
      if (query.from) (filter.createdAt as { $gte?: Date }).$gte = query.from;
      if (query.to) (filter.createdAt as { $lte?: Date }).$lte = query.to;
    } else if (!query.showAll) {
      const since = new Date();
      since.setUTCDate(since.getUTCDate() - 90);
      filter.createdAt = { $gte: since };
    }
    if (query.q?.trim()) {
      const rx = new RegExp(query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ action: rx }, { entityType: rx }];
    }

    const [items, total] = await Promise.all([
      AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLogModel.countDocuments(filter),
    ]);
    const mapped = items.map((a) => ({
      id: String(a._id),
      actorUserId: a.actorUserId ? String(a.actorUserId) : null,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId ? String(a.entityId) : null,
      libraryId: a.libraryId ? String(a.libraryId) : null,
      branchId: a.branchId ? String(a.branchId) : null,
      metadata: a.metadata,
      ipAddress: a.ipAddress,
      userAgent: a.userAgent,
      createdAt: a.createdAt,
    }));
    const enriched = await enrichRowsWithLookups(mapped as Record<string, unknown>[], {
      libraryIdKey: 'libraryId',
      branchIdKey: 'branchId',
      userIdKeys: ['actorUserId'],
    });

    return {
      items: enriched,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getUsage(user: AuthenticatedUser) {
    requireSuper(user);
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [topLibraries, paymentTrend, newLibrariesTrend] = await Promise.all([
      StudentModel.aggregate<{ _id: Types.ObjectId; c: number }>([
        { $group: { _id: '$libraryId', c: { $sum: 1 } } },
        { $sort: { c: -1 } },
        { $limit: 10 },
      ]),
      PaymentRecordModel.aggregate<{ _id: string; total: number }>([
        { $match: { paidAt: { $gte: since }, status: 'ACTIVE' } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
            total: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      LibraryModel.aggregate<{ _id: string; c: number }>([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            c: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const libMeta = await LibraryModel.find({
      _id: { $in: topLibraries.map((t) => t._id).filter(Boolean) },
    })
      .select('name slug')
      .lean();

    const libMap = new Map(libMeta.map((l) => [String(l._id), l]));

    return {
      topLibrariesByStudents: topLibraries.map((t) => ({
        libraryId: String(t._id),
        name: libMap.get(String(t._id))?.name ?? 'Unknown',
        slug: libMap.get(String(t._id))?.slug ?? '',
        students: t.c,
      })),
      paymentTrendLast30d: paymentTrend,
      newLibrariesByMonth: newLibrariesTrend,
    };
  }

  async postAnnouncement(user: AuthenticatedUser, body: PlatformAnnouncementBody) {
    requireSuper(user);
    const r = await notificationsService.send(user, {
      title: body.title,
      message: body.message,
      type: body.type,
      channel: 'IN_APP',
      includeSelf: false,
      target: { mode: 'PLATFORM' },
    });
    await appendPlatformAuditLog({
      actorUserId: user.id,
      action: 'PLATFORM_ANNOUNCEMENT',
      entityType: 'NOTIFICATION',
      entityId: null,
      metadata: { sent: r.sent, title: body.title },
      ipAddress: null,
      userAgent: null,
    });
    return r;
  }

  async recordSnapshots(user: AuthenticatedUser) {
    requireSuper(user);
    const libs = await LibraryModel.find().select('_id').lean();
    const snapshotAt = new Date();
    const since = new Date();
    since.setDate(since.getDate() - 30);

    for (const lib of libs) {
      const lid = lib._id as Types.ObjectId;
      const [studentCount, branchCount, seatCount, invoiceOpenCount, payAgg] = await Promise.all([
        StudentModel.countDocuments({ libraryId: lid }),
        BranchModel.countDocuments({ libraryId: lid }),
        SeatModel.countDocuments({ libraryId: lid }),
        InvoiceModel.countDocuments({
          libraryId: lid,
          status: { $in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
        }),
        PaymentRecordModel.aggregate<{ c: number; sum: number }>([
          { $match: { libraryId: lid, paidAt: { $gte: since }, status: 'ACTIVE' } },
          { $group: { _id: null, c: { $sum: 1 }, sum: { $sum: '$amount' } } },
        ]),
      ]);
      const stuRole = await RoleModel.findOne({ name: ROLES.STUDENT }).select('_id').lean();
      const staffCount = stuRole
        ? await UserModel.countDocuments({ libraryId: lid, isActive: true, role: { $ne: stuRole._id } })
        : 0;

      await TenantUsageSnapshotModel.create({
        libraryId: lid,
        snapshotAt,
        studentCount,
        staffCount,
        branchCount,
        seatCount,
        invoiceOpenCount,
        paymentCount30d: payAgg[0]?.c ?? 0,
        revenue30d: payAgg[0]?.sum ?? 0,
      });
    }

    return { librariesProcessed: libs.length, snapshotAt: snapshotAt.toISOString() };
  }

  /** Future impersonation policy surface (no token issuance yet). */
  impersonationPolicy(_user: AuthenticatedUser) {
    requireSuper(_user);
    return {
      enabled: false,
      design: 'Short-lived signed impersonation tokens; full audit chain; super-only issuance.',
      header: 'X-Impersonation-Context',
    };
  }
}

export const platformService = new PlatformService();
