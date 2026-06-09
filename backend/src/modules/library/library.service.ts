import type { SortOrder } from 'mongoose';
import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { UserModel } from '@modules/auth/auth.models';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';

import { BranchModel, LibraryModel } from './library.models';
import type { IBranchDocument } from './branch.model';
import type { ILibrary } from './library.model';
import { LIBRARY_STATUS } from './library.constants';
import { logActivity } from '@modules/activity/activity-audit.service';
import {
  applyMediaAssetUpdate,
  safeDeleteCloudinaryAsset,
  uploadLibraryLogo,
} from '@/services/upload.service';
import { mediaPublicIdFromField } from '@utils/media-asset.schema';
import { subscriptionBillingService } from '@modules/subscription-billing/subscription-billing.service';
import { BILLING_CYCLE } from '@modules/subscription-billing/subscription-billing.constants';
import { resolveLibrarySubscriptionOnCreate } from './library-subscription-assign';
import { PLAN_LIMIT_ENTITY } from '@modules/subscription-billing/subscription-limit.constants';
import { subscriptionLimitService } from '@modules/subscription-billing/subscription-limit.service';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';
import {
  cascadeDeleteBranch,
  cascadeDeleteLibrary,
  getBranchDeleteImpact,
} from '@/services/tenant-cleanup.service';
import type {
  CreateBranchInput,
  CreateLibraryInput,
  ListBranchesQuery,
  ListLibrariesQuery,
  PatchLibrarySettingsInput,
  UpdateBranchInput,
  UpdateLibraryInput,
} from './library.validation';

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'library';

const toJSON = <T>(doc: unknown): T =>
  JSON.parse(JSON.stringify(doc)) as T;

const assertSuperAdmin = (user: AuthenticatedUser): void => {
  if (user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Super admin access required');
  }
};

const assertLibraryTenant = (user: AuthenticatedUser, libraryId: string): void => {
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (!user.libraryId || user.libraryId !== libraryId) {
    throw ApiError.forbidden('You do not have access to this library');
  }
};

const canManageAllBranchesInLibrary = (user: AuthenticatedUser): boolean =>
  user.role === ROLES.SUPER_ADMIN || user.role === ROLES.LIBRARY_OWNER;

const extractPublicPhotoIds = (settings: Record<string, unknown> | undefined): Set<string> => {
  if (!settings) return new Set();
  const publicPage = settings.publicBookingPage as Record<string, unknown> | undefined;
  const photos = publicPage?.publicPhotos;
  if (!Array.isArray(photos)) return new Set();
  return new Set(
    photos
      .map((photo) => {
        if (!photo || typeof photo !== 'object') return null;
        const publicId = (photo as { publicId?: unknown }).publicId;
        return typeof publicId === 'string' && publicId.trim() ? publicId.trim() : null;
      })
      .filter((value): value is string => Boolean(value)),
  );
};

/** Fields a library owner may update on their tenant profile. */
const LIBRARY_OWNER_SCALAR_FIELDS = new Set([
  'name',
  'email',
  'phone',
  'gstNumber',
  'logo',
  'address',
  'city',
  'state',
  'country',
  'pincode',
  'timezone',
]);

/** SaaS / subscription fields — super admin only. */
const LIBRARY_SAAS_FIELDS = [
  'subscriptionPlan',
  'subscriptionStatus',
  'status',
  'trialEndsAt',
  'subscriptionStartsAt',
  'subscriptionEndsAt',
  'billingCycle',
  'suspendedAt',
  'suspensionReason',
] as const;

const isBranchScopedStaff = (user: AuthenticatedUser): boolean =>
  Boolean(
    user.branchId &&
      user.role !== ROLES.SUPER_ADMIN &&
      user.role !== ROLES.LIBRARY_OWNER,
  );

const assertBranchAccessRead = (
  user: AuthenticatedUser,
  libraryId: string,
  branch: IBranchDocument,
): void => {
  assertLibraryTenant(user, libraryId);
  if (isBranchScopedStaff(user)) {
    if (!user.branchId || user.branchId !== String(branch._id)) {
      throw ApiError.forbidden('You can only access your assigned branch');
    }
  }
};

const assertBranchMutation = (
  user: AuthenticatedUser,
  libraryId: string,
  branch: IBranchDocument,
  action: 'create' | 'update' | 'delete',
): void => {
  assertLibraryTenant(user, libraryId);

  if (action === 'create') {
    if (user.role === ROLES.MANAGER) {
      throw ApiError.forbidden('Only library owners or platform admins can create branches');
    }
    return;
  }

  if (canManageAllBranchesInLibrary(user)) return;

  if (user.role === ROLES.MANAGER) {
    if (action === 'delete') {
      throw ApiError.forbidden('Managers cannot delete branches');
    }
    if (!user.branchId || user.branchId !== String(branch._id)) {
      throw ApiError.forbidden('You can only modify your assigned branch');
    }
    return;
  }

  throw ApiError.forbidden('Insufficient permissions for this branch');
};

const libraryFilterForUser = (
  user: AuthenticatedUser,
): Record<string, unknown> => {
  if (user.role === ROLES.SUPER_ADMIN) return {};
  if (user.libraryId) return { _id: new Types.ObjectId(user.libraryId) };
  return { _id: { $exists: false } }; // impossible filter for users without tenant
};

const branchLibraryFilter = (user: AuthenticatedUser, libraryId: string): Record<string, unknown> => {
  assertLibraryTenant(user, libraryId);
  const base: Record<string, unknown> = { libraryId: new Types.ObjectId(libraryId) };
  if (isBranchScopedStaff(user) && user.branchId) {
    return { ...base, _id: new Types.ObjectId(user.branchId) };
  }
  return base;
};

class LibraryService {
  async listLibraries(user: AuthenticatedUser, query: ListLibrariesQuery) {
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = { ...libraryFilterForUser(user) };

    if (query.status) filter.status = query.status;
    if (query.country) filter.country = new RegExp(`^${escapeRegex(query.country)}$`, 'i');
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

    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: rx }, { slug: rx }, { email: rx }, { city: rx }];
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [items, total] = await Promise.all([
      LibraryModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      LibraryModel.countDocuments(filter),
    ]);

    let rows = items.map((l) => toJSON(l)) as Array<Record<string, unknown>>;
    rows = await subscriptionBillingService.enrichLibrariesWithSubscription(rows);

    if (query.expiryState) {
      rows = rows.filter((r) => (r.subscription as { expiryState?: string })?.expiryState === query.expiryState);
    }

    return {
      items: rows,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getLibraryById(user: AuthenticatedUser, libraryId: string) {
    const lib = await LibraryModel.findById(libraryId).lean();
    if (!lib) throw ApiError.notFound('Library not found');
    assertLibraryTenant(user, libraryId);
    const [enriched] = await subscriptionBillingService.enrichLibrariesWithSubscription([
      toJSON(lib) as Record<string, unknown>,
    ]);
    return enriched;
  }

  async createLibrary(
    actor: AuthenticatedUser,
    input: CreateLibraryInput,
    logoFile?: Express.Multer.File,
  ) {
    assertSuperAdmin(actor);

    const slug = input.slug?.trim() || slugify(input.name);
    const exists = await LibraryModel.findOne({ slug }).lean();
    if (exists) throw ApiError.conflict('A library with this slug already exists');

    const { logo, ownerId, slug: _slug, settings, subscription: _sub, ...libraryScalars } = input;

    const resolved = await resolveLibrarySubscriptionOnCreate(input);

    let logoField: ILibrary['logo'] | undefined;
    if (logoFile) {
      logoField = await uploadLibraryLogo(logoFile, null);
    } else if (logo != null && logo !== '') {
      logoField = logo as ILibrary['logo'];
    }

    const doc = await LibraryModel.create({
      ...libraryScalars,
      status: resolved.status,
      subscriptionPlan: resolved.subscriptionPlan,
      subscriptionStatus: resolved.subscriptionStatus,
      subscriptionStartsAt: resolved.subscriptionStartsAt,
      subscriptionEndsAt: resolved.subscriptionEndsAt,
      trialEndsAt: resolved.trialEndsAt,
      billingCycle: resolved.billingCycle,
      ...(logoField !== undefined ? { logo: logoField } : {}),
      slug,
      ownerId: ownerId ? new Types.ObjectId(ownerId) : null,
      settings: settings ?? {},
    });

    if (input.ownerId) {
      const owner = await UserModel.findById(input.ownerId);
      if (!owner) {
        await LibraryModel.deleteOne({ _id: doc._id });
        throw ApiError.badRequest('Owner user not found');
      }
      await UserModel.updateOne(
        { _id: input.ownerId },
        { $set: { libraryId: doc._id, branchId: null } },
      );
    }

    const sub = input.subscription;
    if (
      sub?.createInvoice &&
      resolved.planIdForInvoice &&
      resolved.status !== LIBRARY_STATUS.TRIAL
    ) {
      const issueDate = resolved.subscriptionStartsAt;
      const dueDate = sub.invoiceDueDate ?? sub.dueDate ?? issueDate;
      const billingCycle =
        resolved.billingCycle === 'MONTHLY'
          ? BILLING_CYCLE.MONTHLY
          : resolved.billingCycle === 'YEARLY'
            ? BILLING_CYCLE.YEARLY
            : BILLING_CYCLE.CUSTOM;

      type SubPaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'WALLET' | 'OTHER';
      const allowedPayment: SubPaymentMethod[] = [
        'CASH',
        'UPI',
        'CARD',
        'BANK_TRANSFER',
        'WALLET',
        'OTHER',
      ];
      const paymentMethod = allowedPayment.includes(sub.paymentMethod as SubPaymentMethod)
        ? (sub.paymentMethod as SubPaymentMethod)
        : undefined;

      await subscriptionBillingService.createPlatformInvoice(actor, {
        libraryId: String(doc._id),
        planId: String(resolved.planIdForInvoice),
        billingCycle,
        issueDate,
        dueDate,
        subscriptionStartDate: resolved.subscriptionStartsAt,
        ...(resolved.subscriptionEndsAt ? { subscriptionEndDate: resolved.subscriptionEndsAt } : {}),
        amountOverride: sub.amount != null,
        allowOverpayment: false,
        ...(sub.amount != null ? { amount: sub.amount } : {}),
        paidAmount: sub.paidAmount ?? 0,
        ...(paymentMethod ? { paymentMethod } : {}),
      });
    }

    const created = await LibraryModel.findById(doc._id).lean();
    const [enriched] = await subscriptionBillingService.enrichLibrariesWithSubscription([
      toJSON(created) as Record<string, unknown>,
    ]);
    return enriched;
  }

  async updateLibrary(
    user: AuthenticatedUser,
    libraryId: string,
    input: UpdateLibraryInput,
    logoFile?: Express.Multer.File,
  ) {
    const lib = await LibraryModel.findById(libraryId);
    if (!lib) throw ApiError.notFound('Library not found');

    if (user.role === ROLES.SUPER_ADMIN) {
      // full access
    } else if (user.role === ROLES.LIBRARY_OWNER) {
      assertLibraryTenant(user, libraryId);
    } else {
      throw ApiError.forbidden('Insufficient permissions to update this library');
    }

    const { ownerId: ownerInput, slug: slugInput, settings: settingsInput, ...scalarUpdates } = input;

    if (user.role !== ROLES.SUPER_ADMIN) {
      if (slugInput !== undefined && slugInput !== lib.slug) {
        throw ApiError.forbidden('Only platform administrators can change the library slug');
      }
      if (ownerInput !== undefined) {
        const currentOwner = lib.ownerId ? String(lib.ownerId) : null;
        const requestedOwner = ownerInput ? String(ownerInput) : null;
        if (requestedOwner !== currentOwner) {
          throw ApiError.forbidden('Only platform administrators can reassign the library owner');
        }
      }
      for (const key of LIBRARY_SAAS_FIELDS) {
        if (scalarUpdates[key as keyof typeof scalarUpdates] !== undefined) {
          throw ApiError.forbidden('Only platform administrators can change subscription or tenant status');
        }
      }
      if (user.role === ROLES.LIBRARY_OWNER) {
        for (const key of Object.keys(scalarUpdates)) {
          if (!LIBRARY_OWNER_SCALAR_FIELDS.has(key)) {
            throw ApiError.forbidden(`Library owners cannot update ${key}`);
          }
        }
      }
    }

    if (slugInput !== undefined && slugInput !== lib.slug) {
      const clash = await LibraryModel.findOne({ slug: slugInput, _id: { $ne: lib._id } }).lean();
      if (clash) throw ApiError.conflict('Slug already in use');
      lib.slug = slugInput;
    }

    if (user.role === ROLES.SUPER_ADMIN && ownerInput !== undefined) {
      if (ownerInput) {
        const newOwner = await UserModel.findById(ownerInput);
        if (!newOwner) throw ApiError.badRequest('Owner user not found');
        if (lib.ownerId && String(lib.ownerId) !== ownerInput) {
          await UserModel.updateOne(
            { _id: lib.ownerId },
            { $set: { libraryId: null, branchId: null } },
          );
        }
        await UserModel.updateOne(
          { _id: ownerInput },
          { $set: { libraryId: lib._id, branchId: null } },
        );
        lib.ownerId = new Types.ObjectId(ownerInput);
      } else {
        if (lib.ownerId) {
          await UserModel.updateOne(
            { _id: lib.ownerId },
            { $set: { libraryId: null, branchId: null } },
          );
        }
        lib.ownerId = null;
      }
    }

    if (logoFile) {
      const nextLogo = await uploadLibraryLogo(logoFile, mediaPublicIdFromField(lib.logo));
      (lib as unknown as Record<string, unknown>).logo = nextLogo ?? undefined;
      delete scalarUpdates.logo;
    }

    if (scalarUpdates.logo !== undefined) {
      const nextLogo = await applyMediaAssetUpdate(lib.logo, scalarUpdates.logo);
      if (nextLogo !== undefined) {
        (lib as unknown as Record<string, unknown>).logo = nextLogo ?? undefined;
      }
      delete scalarUpdates.logo;
    }

    for (const [key, value] of Object.entries(scalarUpdates)) {
      if (value !== undefined) {
        (lib as unknown as Record<string, unknown>)[key] = value;
      }
    }

    if (settingsInput !== undefined) {
      lib.settings = {
        ...(lib.settings as Record<string, unknown>),
        ...settingsInput,
      };
    }

    await lib.save();
    const fresh = await LibraryModel.findById(lib._id).lean();
    return toJSON(fresh);
  }

  async patchSettings(user: AuthenticatedUser, libraryId: string, input: PatchLibrarySettingsInput) {
    const lib = await LibraryModel.findById(libraryId);
    if (!lib) throw ApiError.notFound('Library not found');

    if (user.role === ROLES.SUPER_ADMIN) {
      // ok
    } else if (user.role === ROLES.LIBRARY_OWNER) {
      assertLibraryTenant(user, libraryId);
    } else if (user.permissions.includes(PERMISSIONS.PUBLIC_PAGE_MANAGE)) {
      assertLibraryTenant(user, libraryId);
    } else {
      throw ApiError.forbidden('Insufficient permissions to update library settings');
    }

    const prevSettings = lib.settings as Record<string, unknown>;
    const nextSettings = { ...(lib.settings as Record<string, unknown>), ...input.settings };
    const previousPhotoIds = extractPublicPhotoIds(prevSettings);
    const nextPhotoIds = extractPublicPhotoIds(nextSettings);
    const removedPhotoIds = [...previousPhotoIds].filter((id) => !nextPhotoIds.has(id));

    lib.settings = nextSettings;
    await lib.save();
    await Promise.all(removedPhotoIds.map((publicId) => safeDeleteCloudinaryAsset(publicId)));
    return toJSON(lib.toJSON());
  }

  async deleteLibrary(
    actor: AuthenticatedUser,
    libraryId: string,
    input?: { confirmPhrase?: string; libraryName?: string },
  ) {
    assertSuperAdmin(actor);
    const lib = await LibraryModel.findById(libraryId);
    if (!lib) throw ApiError.notFound('Library not found');

    const expectedPhrase = `DELETE ${lib.name}`.trim();
    const provided = input?.confirmPhrase?.trim() ?? '';
    if (provided !== expectedPhrase) {
      throw ApiError.badRequest(`Type "${expectedPhrase}" to confirm library deletion`);
    }

    await cascadeDeleteLibrary(libraryId);
    return { id: String(lib._id), deleted: true };
  }

  async getBranchDeleteImpactSummary(
    user: AuthenticatedUser,
    libraryId: string,
    branchId: string,
  ) {
    const branch = await BranchModel.findOne({
      _id: new Types.ObjectId(branchId),
      libraryId: new Types.ObjectId(libraryId),
    });
    if (!branch) throw ApiError.notFound('Branch not found');
    assertBranchMutation(user, libraryId, branch, 'delete');
    const impact = await getBranchDeleteImpact(libraryId, branchId);
    return { branchId, branchName: branch.branchName, ...impact };
  }

  async listBranches(user: AuthenticatedUser, libraryId: string, query: ListBranchesQuery) {
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const filter = branchLibraryFilter(user, libraryId);

    if (query.active !== undefined) filter.active = query.active;
    if (query.city) filter.city = new RegExp(`^${escapeRegex(query.city)}$`, 'i');
    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ branchName: rx }, { branchCode: rx }, { email: rx }, { city: rx }];
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [items, total] = await Promise.all([
      BranchModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      BranchModel.countDocuments(filter),
    ]);

    return {
      items: items.map((b) => toJSON(b)),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getBranchById(user: AuthenticatedUser, libraryId: string, branchId: string) {
    const branch = await BranchModel.findOne({
      _id: new Types.ObjectId(branchId),
      libraryId: new Types.ObjectId(libraryId),
    });
    if (!branch) throw ApiError.notFound('Branch not found');
    assertBranchAccessRead(user, libraryId, branch);
    return toJSON(branch.toJSON());
  }

  async createBranch(user: AuthenticatedUser, libraryId: string, input: CreateBranchInput) {
    assertLibraryTenant(user, libraryId);
    if (user.role === ROLES.MANAGER) {
      throw ApiError.forbidden('Only library owners or platform admins can create branches');
    }

    const dup = await BranchModel.findOne({
      libraryId: new Types.ObjectId(libraryId),
      branchCode: input.branchCode,
    }).lean();
    if (dup) throw ApiError.conflict('Branch code already exists in this library');

    const branchUsage = await subscriptionLimitService.getCurrentUsage(libraryId);
    if (branchUsage.branches >= 1) {
      await subscriptionFeatureService.assertFeature(libraryId, 'multi_branch');
    }
    await subscriptionLimitService.validateLimitBeforeCreate(PLAN_LIMIT_ENTITY.BRANCHES, libraryId, {
      actorUserId: user.id,
    });

    const { logo, ...branchScalars } = input;
    const created = await BranchModel.create({
      ...branchScalars,
      ...(logo != null ? { logo } : {}),
      libraryId: new Types.ObjectId(libraryId),
      managerId: input.managerId ? new Types.ObjectId(input.managerId) : null,
    });

    const doc = await BranchModel.findById(created._id).lean();
    logActivity({
      actorUserId: user.id,
      action: 'BRANCH_CREATED',
      entityType: 'BRANCH',
      entityId: String(created._id),
      libraryId,
      branchId: String(created._id),
      metadata: {
        branchName: input.branchName,
        entityLabel: input.branchName,
        description: `Branch ${input.branchCode} created`,
      },
    });
    return toJSON(doc);
  }

  async updateBranch(user: AuthenticatedUser, libraryId: string, branchId: string, input: UpdateBranchInput) {
    const branch = await BranchModel.findOne({
      _id: new Types.ObjectId(branchId),
      libraryId: new Types.ObjectId(libraryId),
    });
    if (!branch) throw ApiError.notFound('Branch not found');

    assertBranchMutation(user, libraryId, branch, 'update');

    if (input.branchCode && input.branchCode !== branch.branchCode) {
      const clash = await BranchModel.findOne({
        libraryId: branch.libraryId,
        branchCode: input.branchCode,
        _id: { $ne: branch._id },
      }).lean();
      if (clash) throw ApiError.conflict('Branch code already exists in this library');
    }

    const { logo: logoInput, ...branchScalars } = input;

    if (logoInput !== undefined) {
      const nextLogo = await applyMediaAssetUpdate(branch.logo, logoInput);
      if (nextLogo !== undefined) {
        branch.logo =
          nextLogo && typeof nextLogo === 'object' && 'publicId' in nextLogo
            ? nextLogo
            : undefined;
      }
    }

    Object.assign(branch, {
      ...branchScalars,
      managerId:
        input.managerId === undefined
          ? branch.managerId
          : input.managerId
            ? new Types.ObjectId(input.managerId)
            : null,
    });
    await branch.save();
    return toJSON(branch.toJSON());
  }

  async deleteBranch(user: AuthenticatedUser, libraryId: string, branchId: string) {
    const branch = await BranchModel.findOne({
      _id: new Types.ObjectId(branchId),
      libraryId: new Types.ObjectId(libraryId),
    });
    if (!branch) throw ApiError.notFound('Branch not found');

    assertBranchMutation(user, libraryId, branch, 'delete');

    await cascadeDeleteBranch(libraryId, branchId);
    return { id: String(branch._id), deleted: true };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const libraryService = new LibraryService();

/** Exported for unit tests (RBAC matrix). */
export const __libraryTestables = {
  assertBranchMutation,
  assertBranchAccessRead,
  branchLibraryFilter,
  libraryFilterForUser,
  isBranchScopedStaff,
  slugify,
};
