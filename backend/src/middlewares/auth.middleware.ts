import type { RequestHandler } from 'express';
import type { Types } from 'mongoose';

import { verifyAccessToken } from '@config/jwt.config';
import { COOKIE_NAMES } from '@constants/http.constants';
import { ROLES } from '@constants/roles.constants';
import { resolveUserPermissions } from '@modules/auth/resolve-user-permissions';
import { ApiError } from '@utils/ApiError';
import { asyncHandler } from '@utils/asyncHandler';
// IMPORTANT: import via the auth-module model barrel so that the Permission
// and Role schemas are also registered with Mongoose by the time we call
// `.populate({ path: 'role', populate: { path: 'permissions' } })` below.
import { UserModel, RoleModel, PermissionModel } from '@modules/auth/auth.models';
import { resolveLibraryOwnerTenantIds } from '@modules/auth/auth-tenant-resolve';
import { assertTenantLibraryActive } from '@modules/library/library-tenant-guard';
import type { AuthenticatedUser } from '@/types/express';

// Keep references so the imports are not tree-shaken; they're only here for
// their model-registration side effect.
void RoleModel;
void PermissionModel;

/**
 * Extracts a JWT from either the `Authorization: Bearer <token>` header
 * or the `access_token` HttpOnly cookie.
 */
const extractAccessToken = (req: Parameters<RequestHandler>[0]): string | null => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  const cookieToken = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
  if (typeof cookieToken === 'string' && cookieToken.length > 0) return cookieToken;
  return null;
};

/**
 * Verifies the access token, loads the user (with role + permissions) from DB,
 * and attaches a sanitized `AuthenticatedUser` to `req.user`.
 *
 * We always re-load from DB so that:
 *  - Disabled users are blocked immediately.
 *  - Role/permission changes apply without waiting for token expiry.
 */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = extractAccessToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');

  const payload = verifyAccessToken(token);
  if (payload.tokenType !== 'access') {
    throw ApiError.unauthorized('Invalid token type');
  }

  const user = await UserModel.findById(payload.sub)
    .populate({
      path: 'role',
      populate: { path: 'permissions', select: 'name' },
    })
    .lean();

  if (!user) throw ApiError.unauthorized('User no longer exists');
  if (!user.isActive) throw ApiError.forbidden('User account is disabled');

  const role = user.role as unknown as {
    name: string;
    permissions: { name: string }[];
  } | null;

  if (!role) throw ApiError.forbidden('No role assigned to user');

  const resolved = await resolveLibraryOwnerTenantIds(
    user._id as Types.ObjectId,
    role.name,
    user.libraryId as Types.ObjectId | null | undefined,
    user.branchId as Types.ObjectId | null | undefined,
  );

  const authUser: AuthenticatedUser = {
    id: String(user._id),
    role: role.name as AuthenticatedUser['role'],
    permissions: resolveUserPermissions(role.name, role.permissions),
    libraryId: resolved.libraryId,
    branchId: resolved.branchId,
  };

  await assertTenantLibraryActive(resolved.libraryId, role.name);

  req.user = authUser;
  next();
});

/**
 * Helper - throws if there is no authenticated user.
 * Use inside services/controllers that should never run anonymously.
 */
export const requireAuthUser = (
  user: AuthenticatedUser | undefined,
): AuthenticatedUser => {
  if (!user) throw ApiError.unauthorized('Authentication required');
  return user;
};

/**
 * Convenience guard - SUPER_ADMIN only (cross-tenant operations).
 */
export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  const user = requireAuthUser(req.user);
  if (user.role !== ROLES.SUPER_ADMIN) {
    return next(ApiError.forbidden('Super admin access required'));
  }
  next();
};
