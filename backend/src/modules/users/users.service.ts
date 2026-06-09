import type { SortOrder } from 'mongoose';
import { Types } from 'mongoose';

import { ROLES, type RoleName } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { enrichRowsWithLookups } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { UserModel, RoleModel } from '@modules/auth/auth.models';
import type { IUserDocument } from '@modules/auth/user.model';
import { BranchModel } from '@modules/library/library.models';

import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';

import { USER_AUDIT_ACTION, USER_STATUS } from './users.constants';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.validation';
import { PLAN_LIMIT_ENTITY } from '@modules/subscription-billing/subscription-limit.constants';
import { subscriptionLimitService } from '@modules/subscription-billing/subscription-limit.service';
import { StudentModel } from '@modules/students/students.models';
import { deleteStudentMedia } from '@/services/media-cleanup.service';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Staff roles a library owner may provision via Users API (not STUDENT). */
const OWNER_CREATABLE: RoleName[] = [
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
];

/** Staff roles that require libraryId + branchId on create. */
const USERS_MODULE_STAFF_ROLES: RoleName[] = [
  ROLES.MANAGER,
  ROLES.RECEPTIONIST,
  ROLES.ACCOUNTANT,
  ROLES.SECURITY,
];

/** Includes STUDENT for update rules when a student login row exists. */
const BRANCH_SCOPED: RoleName[] = [...USERS_MODULE_STAFF_ROLES, ROLES.STUDENT];

const assertBranchInLibrary = async (branchId: string, libraryId: Types.ObjectId): Promise<void> => {
  const branch = await BranchModel.findOne({
    _id: new Types.ObjectId(branchId),
    libraryId,
  }).lean();
  if (!branch) throw ApiError.badRequest('Branch not found for this library');
};

const resolveLibraryFromBranch = async (branchId: string): Promise<Types.ObjectId> => {
  const branch = await BranchModel.findById(branchId).select('libraryId').lean();
  if (!branch?.libraryId) throw ApiError.badRequest('Branch not found');
  return branch.libraryId as Types.ObjectId;
};

const loadSystemRole = async (name: RoleName) => {
  const role = await RoleModel.findOne({ name, isSystem: true, libraryId: null })
    .select('_id name')
    .lean();
  if (!role) {
    throw ApiError.internal(`System role "${name}" not found. Run npm run seed:rbac.`);
  }
  return role;
};

const mapUserRow = (user: Record<string, unknown>) => {
  const role = user.role as { name?: string } | undefined;
  const status =
    (user.status as string | undefined) ??
    (user.isActive === false ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE);
  return {
    ...user,
    role: typeof role === 'object' && role?.name ? role.name : role,
    status,
    isRootSuperAdmin: Boolean(user.isRootSuperAdmin),
  };
};

function syncStatusFields(user: IUserDocument, status: string): void {
  user.status = status;
  user.isActive = status === USER_STATUS.ACTIVE;
}

function assertNotRootTarget(user: IUserDocument, action: string): void {
  if (user.isRootSuperAdmin) {
    void appendPlatformAuditLog({
      actorUserId: null,
      action: USER_AUDIT_ACTION.ROOT_SUPER_ADMIN_PROTECTED,
      entityType: 'USER',
      entityId: String(user._id),
      metadata: { attemptedAction: action },
    });
    throw ApiError.forbidden('Root Super Admin cannot be deleted or deactivated.');
  }
}

class UsersService {
  private assertTenantRead(actor: AuthenticatedUser): void {
    if (actor.role === ROLES.SUPER_ADMIN) return;
    if (actor.permissions.includes(PERMISSIONS.USER_READ) || actor.permissions.includes(PERMISSIONS.STAFF_READ)) {
      if (actor.role === ROLES.LIBRARY_OWNER && !actor.libraryId) {
        throw ApiError.forbidden('Tenant library context required');
      }
      return;
    }
    throw ApiError.forbidden('Insufficient permissions');
  }

  async listUsers(actor: AuthenticatedUser, query: ListUsersQuery) {
    this.assertTenantRead(actor);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });

    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
      if (query.status === USER_STATUS.ACTIVE) filter.isActive = true;
      if (query.status === USER_STATUS.INACTIVE || query.status === USER_STATUS.DELETED) {
        filter.isActive = false;
      }
    } else if (query.isActive !== undefined) {
      filter.isActive = query.isActive;
      filter.status = query.isActive ? USER_STATUS.ACTIVE : USER_STATUS.INACTIVE;
    } else if (!query.includeInactive) {
      filter.isActive = true;
      filter.status = USER_STATUS.ACTIVE;
    }

    if (query.createdFrom || query.createdTo) {
      filter.createdAt = {} as Record<string, Date>;
      if (query.createdFrom) (filter.createdAt as { $gte?: Date }).$gte = query.createdFrom;
      if (query.createdTo) (filter.createdAt as { $lte?: Date }).$lte = query.createdTo;
    }

    if (actor.role === ROLES.SUPER_ADMIN) {
      if (query.libraryId) filter.libraryId = new Types.ObjectId(query.libraryId);
      if (query.branchId) filter.branchId = new Types.ObjectId(query.branchId);
    } else if (actor.role === ROLES.LIBRARY_OWNER) {
      if (!actor.libraryId) throw ApiError.forbidden('Tenant library context required');
      filter.libraryId = new Types.ObjectId(actor.libraryId);
      if (query.branchId) {
        await assertBranchInLibrary(query.branchId, new Types.ObjectId(actor.libraryId));
        filter.branchId = new Types.ObjectId(query.branchId);
      }
    } else {
      throw ApiError.forbidden('Insufficient permissions to list users');
    }

    if (query.role) {
      const roleDoc = await RoleModel.findOne({
        name: query.role,
        $or: [{ libraryId: null, isSystem: true }, ...(actor.libraryId ? [{ libraryId: new Types.ObjectId(actor.libraryId) }] : [])],
      })
        .select('_id')
        .lean();
      if (!roleDoc) {
        return {
          items: [],
          meta: { pagination: buildPaginationMeta(0, page, limit) },
        };
      }
      filter.role = roleDoc._id;
    } else if (actor.role === ROLES.LIBRARY_OWNER) {
      const superRole = await RoleModel.findOne({ name: ROLES.SUPER_ADMIN, isSystem: true, libraryId: null })
        .select('_id')
        .lean();
      if (superRole?._id) {
        filter.role = { $ne: superRole._id };
      }
    }

    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ fullName: rx }, { email: rx }, { phone: rx }];
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [raw, total] = await Promise.all([
      UserModel.find(filter)
        .populate('role', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const items = raw.map((u) => toJSON(mapUserRow(u as unknown as Record<string, unknown>)));
    const enriched = await enrichRowsWithLookups(items as Record<string, unknown>[], {
      libraryIdKey: 'libraryId',
      branchIdKey: 'branchId',
    });

    return {
      items: enriched,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getUserById(actor: AuthenticatedUser, userId: string) {
    this.assertTenantRead(actor);
    const user = await UserModel.findById(userId).populate('role', 'name').lean();
    if (!user) throw ApiError.notFound('User not found');
    await this.assertRowAccess(actor, user as unknown as IUserDocument);
    const row = toJSON(mapUserRow(user as unknown as Record<string, unknown>));
    const [enriched] = await enrichRowsWithLookups([row as Record<string, unknown>], {
      libraryIdKey: 'libraryId',
      branchIdKey: 'branchId',
    });
    return enriched;
  }

  private async assertRowAccess(actor: AuthenticatedUser, user: IUserDocument | Record<string, unknown>): Promise<void> {
    const lib = (user as { libraryId?: Types.ObjectId | null }).libraryId;
    const roleId = (user as { role?: Types.ObjectId | { name?: string } }).role;
    const roleName =
      typeof roleId === 'object' && roleId && 'name' in roleId && typeof (roleId as { name: string }).name === 'string'
        ? (roleId as { name: string }).name
        : null;

    if (actor.role === ROLES.SUPER_ADMIN) return;

    if (!actor.libraryId) throw ApiError.forbidden('Tenant library context required');
    if (!lib || String(lib) !== actor.libraryId) {
      throw ApiError.forbidden('You do not have access to this user');
    }
    if (roleName === ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('You do not have access to this user');
    }
  }

  async createUser(actor: AuthenticatedUser, input: CreateUserInput) {
    const roleName = input.role as RoleName;

    if (actor.role === ROLES.SUPER_ADMIN) {
      if (!actor.permissions.includes(PERMISSIONS.USER_CREATE)) {
        throw ApiError.forbidden('Insufficient permissions to create users');
      }
    } else if (actor.role === ROLES.LIBRARY_OWNER) {
      if (!actor.permissions.includes(PERMISSIONS.STAFF_CREATE)) {
        throw ApiError.forbidden('Insufficient permissions to create staff');
      }
      if (!OWNER_CREATABLE.includes(roleName)) {
        throw ApiError.badRequest('This role cannot be created by a library owner');
      }
    } else {
      throw ApiError.forbidden('Insufficient permissions to create users');
    }

    let libraryId: Types.ObjectId | null = null;
    let branchId: Types.ObjectId | null = null;

    if (USERS_MODULE_STAFF_ROLES.includes(roleName)) {
      if (!input.branchId) throw ApiError.badRequest('branchId is required');
      if (!input.libraryId) throw ApiError.badRequest('libraryId is required');
      libraryId = await resolveLibraryFromBranch(input.branchId);
      if (String(libraryId) !== String(input.libraryId)) {
        throw ApiError.badRequest('libraryId does not match the selected branch');
      }
      await assertBranchInLibrary(input.branchId, libraryId);
      branchId = new Types.ObjectId(input.branchId);

      if (actor.role === ROLES.LIBRARY_OWNER) {
        if (!actor.libraryId || String(libraryId) !== actor.libraryId) {
          throw ApiError.forbidden('Branch is not part of your library');
        }
      }

      await subscriptionLimitService.validateLimitBeforeCreate(
        PLAN_LIMIT_ENTITY.STAFF,
        String(libraryId),
        { actorUserId: actor.id },
      );
    } else if (roleName === ROLES.LIBRARY_OWNER) {
      if (actor.role === ROLES.LIBRARY_OWNER) {
        throw ApiError.forbidden('You cannot create this role');
      }
      if (!input.libraryId) throw ApiError.badRequest('libraryId is required');
      if (input.branchId) throw ApiError.badRequest('branchId must be empty for LIBRARY_OWNER');
      libraryId = new Types.ObjectId(input.libraryId);
      branchId = null;
    } else if (roleName === ROLES.SUPER_ADMIN) {
      if (actor.role === ROLES.LIBRARY_OWNER) {
        throw ApiError.forbidden('You cannot create this role');
      }
      if (input.libraryId) throw ApiError.badRequest('libraryId must be empty for SUPER_ADMIN');
      if (input.branchId) throw ApiError.badRequest('branchId must be empty for SUPER_ADMIN');
      libraryId = null;
      branchId = null;
    } else {
      throw ApiError.badRequest('Unsupported role for user provisioning');
    }

    const roleDoc = await loadSystemRole(roleName);
    const existing = await UserModel.findOne({ email: input.email }).lean();
    if (existing) throw ApiError.conflict('An account with this email already exists');

    const passwordHash = await UserModel.hashPassword(input.password);

    const created = await UserModel.create({
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim(),
      passwordHash,
      role: roleDoc._id,
      libraryId,
      branchId,
      isActive: input.isActive ?? true,
      status: input.isActive === false ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE,
      isRootSuperAdmin: false,
      isEmailVerified: false,
      refreshTokens: [],
    });

    const out = await UserModel.findById(created._id).populate('role', 'name').lean();
    return toJSON(mapUserRow(out as unknown as Record<string, unknown>));
  }

  async updateUser(actor: AuthenticatedUser, userId: string, input: UpdateUserInput) {
    if (actor.role === ROLES.SUPER_ADMIN) {
      if (!actor.permissions.includes(PERMISSIONS.USER_UPDATE)) {
        throw ApiError.forbidden('Insufficient permissions to update users');
      }
    } else if (actor.role === ROLES.LIBRARY_OWNER) {
      if (!actor.permissions.includes(PERMISSIONS.STAFF_UPDATE)) {
        throw ApiError.forbidden('Insufficient permissions to update staff');
      }
    } else {
      throw ApiError.forbidden('Insufficient permissions to update users');
    }

    const user = await UserModel.findById(userId).populate('role', 'name');
    if (!user) throw ApiError.notFound('User not found');
    await this.assertRowAccess(actor, user);

    const currentRole = (user.role as unknown as { name: string }).name as RoleName;

    if (input.role) {
      const next = input.role as RoleName;
      if (actor.role === ROLES.LIBRARY_OWNER) {
        if (next !== currentRole) {
          throw ApiError.forbidden('You cannot change this user role');
        }
      }
      if (next !== currentRole) {
        const roleDoc = await loadSystemRole(next);
        user.role = roleDoc._id as unknown as typeof user.role;
      }
    }

    if (input.fullName !== undefined) user.fullName = input.fullName.trim();
    if (input.email !== undefined) user.email = input.email.trim().toLowerCase();
    if (input.phone !== undefined) user.phone = input.phone?.trim();
    if (input.isActive !== undefined) {
      user.isActive = input.isActive;
      user.status = input.isActive ? USER_STATUS.ACTIVE : USER_STATUS.INACTIVE;
    }
    if (input.password) user.passwordHash = await UserModel.hashPassword(input.password);

    if (actor.role === ROLES.SUPER_ADMIN) {
      if (input.libraryId !== undefined) {
        user.libraryId = input.libraryId ? new Types.ObjectId(input.libraryId) : null;
      }
      if (input.branchId !== undefined) {
        user.branchId = input.branchId ? new Types.ObjectId(input.branchId) : null;
      }
    } else if (actor.role === ROLES.LIBRARY_OWNER) {
      if (input.libraryId !== undefined) {
        throw ApiError.forbidden('You cannot reassign library');
      }
      if (input.branchId !== undefined) {
        if (!input.branchId) {
          user.branchId = null;
        } else {
          await assertBranchInLibrary(input.branchId, new Types.ObjectId(actor.libraryId!));
          user.branchId = new Types.ObjectId(input.branchId);
        }
      }
    }

    const nextRoleName = (input.role as RoleName | undefined) ?? currentRole;
    if (BRANCH_SCOPED.includes(nextRoleName) && !user.branchId) {
      throw ApiError.badRequest('branchId is required for this role');
    }
    if ((nextRoleName === ROLES.LIBRARY_OWNER || nextRoleName === ROLES.SUPER_ADMIN) && user.branchId) {
      user.branchId = null;
    }

    await user.save();
    const out = await UserModel.findById(user._id).populate('role', 'name').lean();
    return toJSON(mapUserRow(out as unknown as Record<string, unknown>));
  }

  private assertUserLifecyclePermission(actor: AuthenticatedUser, action: 'deactivate' | 'delete'): void {
    if (actor.role === ROLES.SUPER_ADMIN) {
      if (!actor.permissions.includes(PERMISSIONS.USER_DELETE)) {
        throw ApiError.forbidden(`Insufficient permissions to ${action} users`);
      }
      return;
    }
    if (actor.role === ROLES.LIBRARY_OWNER && action === 'deactivate') {
      if (!actor.permissions.includes(PERMISSIONS.STAFF_DELETE)) {
        throw ApiError.forbidden('Insufficient permissions to deactivate staff');
      }
      return;
    }
    throw ApiError.forbidden(`Insufficient permissions to ${action} users`);
  }

  async activateUser(actor: AuthenticatedUser, userId: string) {
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('Only Super Admin can activate users');
    }
    if (!actor.permissions.includes(PERMISSIONS.USER_UPDATE)) {
      throw ApiError.forbidden('Insufficient permissions to activate users');
    }

    const user = await UserModel.findById(userId).populate('role', 'name');
    if (!user) throw ApiError.notFound('User not found');
    if (user.status === USER_STATUS.DELETED) {
      throw ApiError.badRequest('Deleted users cannot be reactivated from this action');
    }

    syncStatusFields(user, USER_STATUS.ACTIVE);
    await user.save();

    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: USER_AUDIT_ACTION.USER_ACTIVATED,
      entityType: 'USER',
      entityId: userId,
      libraryId: user.libraryId ? String(user.libraryId) : null,
      branchId: user.branchId ? String(user.branchId) : null,
      metadata: { module: 'users' },
    });

    return { id: String(user._id), status: user.status, isActive: user.isActive };
  }

  async deactivateUser(actor: AuthenticatedUser, userId: string) {
    this.assertUserLifecyclePermission(actor, 'deactivate');

    if (String(actor.id) === userId) {
      throw ApiError.badRequest('You cannot deactivate your own account');
    }

    const user = await UserModel.findById(userId).select('+refreshTokens').populate('role', 'name');
    if (!user) throw ApiError.notFound('User not found');
    await this.assertRowAccess(actor, user);
    assertNotRootTarget(user, 'deactivate');

    const roleName = (user.role as unknown as { name: string }).name;
    if (roleName === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
      throw ApiError.forbidden('You cannot deactivate this user');
    }

    syncStatusFields(user, USER_STATUS.INACTIVE);
    user.refreshTokens = [];
    await user.save();

    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: USER_AUDIT_ACTION.USER_DEACTIVATED,
      entityType: 'USER',
      entityId: userId,
      libraryId: user.libraryId ? String(user.libraryId) : null,
      branchId: user.branchId ? String(user.branchId) : null,
      metadata: { module: 'users' },
    });

    return { id: String(user._id), status: user.status, isActive: user.isActive };
  }

  async deleteUser(actor: AuthenticatedUser, userId: string) {
    this.assertUserLifecyclePermission(actor, 'delete');

    if (String(actor.id) === userId) {
      throw ApiError.badRequest('You cannot delete your own account');
    }

    const user = await UserModel.findById(userId).select('+refreshTokens').populate('role', 'name');
    if (!user) throw ApiError.notFound('User not found');
    await this.assertRowAccess(actor, user);
    assertNotRootTarget(user, 'delete');

    const linkedStudent = await StudentModel.findOne({ userId: user._id }).lean();
    if (linkedStudent) {
      await deleteStudentMedia(linkedStudent);
      await StudentModel.updateOne(
        { _id: linkedStudent._id },
        { $unset: { profilePhoto: 1, documentProof: 1 } },
      );
    }

    syncStatusFields(user, USER_STATUS.DELETED);
    user.refreshTokens = [];
    await user.save();

    await appendPlatformAuditLog({
      actorUserId: actor.id,
      action: USER_AUDIT_ACTION.USER_DELETED,
      entityType: 'USER',
      entityId: userId,
      libraryId: user.libraryId ? String(user.libraryId) : null,
      branchId: user.branchId ? String(user.branchId) : null,
      metadata: { module: 'users' },
    });

    return { id: String(user._id), status: user.status, isActive: user.isActive };
  }
}

export const usersService = new UsersService();
