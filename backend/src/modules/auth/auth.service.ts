import crypto from 'node:crypto';
import type { Types } from 'mongoose';

import { ApiError } from '@utils/ApiError';
import { mediaUrlFromField } from '@utils/media-asset.schema';
import type { RoleCapabilityModule } from '@constants/role-capabilities.constants';
import type { RoleCapabilityActionMatrix } from '@constants/role-capability-actions.constants';
import { deriveModuleFlagsFromActions } from '@constants/role-capability-actions.constants';
import { roleCapabilityService } from '@modules/platform/role-capability.service';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@config/jwt.config';
import { ENV } from '@config/env.config';
import { canonicalPermissionName } from '@constants/permissions.constants';
import { resolveUserPermissions } from './resolve-user-permissions';
import { ROLES, type RoleName } from '@constants/roles.constants';

// IMPORTANT: import all models from the central barrel so Permission, Role
// and User schemas are all registered with Mongoose before any `.populate()`
// call runs (Role.permissions -> Permission, User.role -> Role).
import {
  UserModel,
  RoleModel,
  PermissionModel,
  type IUserDocument,
} from './auth.models';
import { applyResolvedTenantToUserDocument } from './auth-tenant-resolve';
import { assertTenantLibraryActive } from '@modules/library/library-tenant-guard';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';
import { sendPasswordResetEmail } from '@/services/email.service';
import { AUTH_CONSTANTS } from './auth.constants';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
} from './auth.validation';
import { StudentModel } from '@modules/students/students.models';

// Touch PermissionModel so the import is not tree-shaken at build time and
// the schema is guaranteed to be registered before any populate('permissions').
void PermissionModel;

/**
 * Business logic for authentication.
 *
 * - Controllers must stay thin and only call into this service.
 * - This service NEVER touches `req`/`res`; it returns plain values.
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SafeUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: RoleName;
  permissions: string[];
  libraryId: string | null;
  branchId: string | null;
  studentId: string | null;
  libraryName: string | null;
  libraryLogo: string | null;
  branchName: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roleModules: Record<RoleCapabilityModule, boolean>;
  roleCapabilities: RoleCapabilityActionMatrix[RoleName];
  /** Effective SaaS plan features for the user's library (staff + owner). */
  subscriptionFeatures?: Record<string, boolean>;
  /** Alias of `subscriptionFeatures` — plan flags + tenant overrides. */
  effectiveFeatures?: Record<string, boolean>;
  enabledFeaturesOverride?: string[];
  disabledFeaturesOverride?: string[];
  subscriptionPlanName?: string;
}

export interface DeviceMeta {
  userAgent?: string;
  ipAddress?: string;
}

const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const hashResetToken = hashRefreshToken;

const parseDurationToMs = (input: string): number => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) return 0;
  const v = Number(match[1]);
  switch (match[2]) {
    case 'ms': return v;
    case 's':  return v * 1000;
    case 'm':  return v * 60 * 1000;
    case 'h':  return v * 60 * 60 * 1000;
    case 'd':  return v * 24 * 60 * 60 * 1000;
    default:   return 0;
  }
};

/**
 * Resolves a "system" role by enum name. Throws if seeders haven't run.
 */
const getSystemRoleByName = async (name: RoleName) => {
  const role = await RoleModel.findOne({ name, isSystem: true, libraryId: null })
    .populate('permissions', 'name')
    .lean();
  if (!role) {
    throw ApiError.internal(
      `System role "${name}" not found. Did you run the RBAC seeder (npm run seed:rbac)?`,
    );
  }
  return role;
};

/**
 * Build a JSON-safe representation of an authenticated user.
 */
const toSafeUser = (
  user: IUserDocument | (IUserDocument & { toObject: () => Record<string, unknown> }),
  role: { name: string; permissions?: { name: string }[] },
): SafeUser => ({
  id: String(user._id),
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: role.name as RoleName,
  permissions: resolveUserPermissions(role.name, role.permissions),
  libraryId: user.libraryId ? String(user.libraryId) : null,
  branchId: user.branchId ? String(user.branchId) : null,
  studentId: null,
  libraryName: null,
  libraryLogo: null,
  branchName: null,
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  lastLoginAt: user.lastLoginAt ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  roleModules: {} as Record<RoleCapabilityModule, boolean>,
  roleCapabilities: {} as RoleCapabilityActionMatrix[RoleName],
});

const attachTenantBranding = async (safe: SafeUser): Promise<SafeUser> => {
  if (safe.role === ROLES.SUPER_ADMIN || !safe.libraryId) return safe;
  const [lib, branch] = await Promise.all([
    LibraryModel.findById(safe.libraryId).select('name logo').lean(),
    safe.branchId
      ? BranchModel.findById(safe.branchId).select('branchName').lean()
      : Promise.resolve(null),
  ]);
  return {
    ...safe,
    libraryName: lib?.name ? String(lib.name) : null,
    libraryLogo: lib?.logo ? mediaUrlFromField(lib.logo) : null,
    branchName: branch?.branchName ? String(branch.branchName) : null,
  };
};

const attachRoleCapabilities = async (safe: SafeUser): Promise<SafeUser> => {
  const roleCapabilities = await roleCapabilityService.getActionMatrixForRole(safe.role);
  const roleModules = deriveModuleFlagsFromActions(roleCapabilities);
  return { ...safe, roleModules, roleCapabilities };
};

const attachSubscriptionFeatures = async (safe: SafeUser): Promise<SafeUser> => {
  if (!safe.libraryId || safe.role === ROLES.SUPER_ADMIN) return safe;
  const effective = await subscriptionFeatureService.resolveEffectiveFeatures(safe.libraryId);
  return {
    ...safe,
    subscriptionFeatures: effective.features,
    effectiveFeatures: effective.features,
    enabledFeaturesOverride: effective.enabledFeaturesOverride,
    disabledFeaturesOverride: effective.disabledFeaturesOverride,
    subscriptionPlanName: effective.planName,
  };
};

const attachStudentIdForStudentRole = async (
  safe: SafeUser,
  userId: string,
): Promise<SafeUser> => {
  let out = await attachRoleCapabilities(safe);
  out = await attachSubscriptionFeatures(out);
  if (out.role === ROLES.STUDENT) {
    const student = await StudentModel.findOne({ userId }).select('_id').lean();
    out = { ...out, studentId: student ? String(student._id) : null };
  }
  return attachTenantBranding(out);
};

/**
 * Issue an access + refresh token pair AND persist a hashed copy of the
 * refresh token on the user document (with rotation cap).
 */
const issueTokensForUser = async (
  user: IUserDocument,
  roleName: RoleName,
  device: DeviceMeta,
): Promise<AuthTokens> => {
  const payload = {
    sub: String(user._id),
    role: roleName,
    libraryId: user.libraryId ? String(user.libraryId) : null,
    branchId: user.branchId ? String(user.branchId) : null,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const expiresAt = new Date(Date.now() + parseDurationToMs(ENV.JWT_REFRESH_EXPIRES_IN));

  // Append + trim oldest refresh tokens to cap stored sessions per user.
  await UserModel.updateOne(
    { _id: user._id },
    {
      $push: {
        refreshTokens: {
          $each: [
            {
              tokenHash: hashRefreshToken(refreshToken),
              expiresAt,
              createdAt: new Date(),
              userAgent: device.userAgent,
              ipAddress: device.ipAddress,
            },
          ],
          $slice: -AUTH_CONSTANTS.MAX_REFRESH_TOKENS_PER_USER,
        },
      },
      $set: { lastLoginAt: new Date() },
    },
  );

  return { accessToken, refreshToken };
};

class AuthService {
  private assertUserMayAuthenticate(user: IUserDocument): void {
    const status = user.status ?? (user.isActive ? 'ACTIVE' : 'INACTIVE');
    if (status === 'DELETED' || status === 'INACTIVE' || !user.isActive) {
      throw ApiError.forbidden('Your account has been deactivated.');
    }
    if (status === 'SUSPENDED') {
      throw ApiError.forbidden('Your account has been suspended.');
    }
  }

  /**
   * Login with email + password. Always returns a generic error on failure
   * to avoid leaking whether an email exists.
   */
  async login(
    input: LoginInput,
    device: DeviceMeta,
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    const user = await UserModel.findOne({ email: input.email })
      .select('+passwordHash +refreshTokens')
      .populate({ path: 'role', populate: { path: 'permissions', select: 'name' } });

    if (!user) throw ApiError.unauthorized(AUTH_CONSTANTS.INVALID_CREDENTIALS_MSG);
    this.assertUserMayAuthenticate(user);

    const ok = await user.comparePassword(input.password);
    if (!ok) throw ApiError.unauthorized(AUTH_CONSTANTS.INVALID_CREDENTIALS_MSG);

    const role = user.role as unknown as {
      name: RoleName;
      permissions: { name: string }[];
    };

    await applyResolvedTenantToUserDocument(user, role.name);
    await assertTenantLibraryActive(user.libraryId ? String(user.libraryId) : null, role.name);
    const tokens = await issueTokensForUser(user, role.name, device);
    const safe = toSafeUser(user, role);
    const out = { user: await attachStudentIdForStudentRole(safe, String(user._id)), tokens };
    try {
      await appendPlatformAuditLog({
        actorUserId: String(user._id),
        action: 'LOGIN',
        entityType: 'USER',
        entityId: String(user._id),
        libraryId: user.libraryId ? String(user.libraryId) : null,
        branchId: user.branchId ? String(user.branchId) : null,
        metadata: { channel: 'password' },
        ipAddress: device.ipAddress ?? null,
        userAgent: device.userAgent ?? null,
      });
    } catch {
      // non-fatal
    }
    return out;
  }

  /**
   * Refresh access token using a valid refresh token.
   * Rotates the refresh token (revokes old, issues new).
   */
  async refresh(
    refreshToken: string,
    device: DeviceMeta,
  ): Promise<{ user: SafeUser; tokens: AuthTokens }> {
    if (!refreshToken) throw ApiError.unauthorized('Refresh token missing');

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    if (payload.tokenType !== 'refresh') {
      throw ApiError.unauthorized('Invalid token type');
    }

    const user = await UserModel.findById(payload.sub)
      .select('+refreshTokens')
      .populate({ path: 'role', populate: { path: 'permissions', select: 'name' } });

    if (!user) throw ApiError.unauthorized('User no longer exists');
    this.assertUserMayAuthenticate(user);

    const submittedHash = hashRefreshToken(refreshToken);
    const stored = user.refreshTokens.find((t) => t.tokenHash === submittedHash);

    if (!stored) {
      // Suspicious: refresh token reuse. Best practice: revoke all sessions.
      user.refreshTokens = [];
      await user.save();
      throw ApiError.unauthorized('Refresh token reuse detected. Please log in again.');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== submittedHash);
      await user.save();
      throw ApiError.unauthorized('Refresh token expired');
    }

    // Rotate: remove the used refresh token, then issue a new pair.
    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== submittedHash);
    await user.save();

    const role = user.role as unknown as { name: RoleName; permissions: { name: string }[] };
    await applyResolvedTenantToUserDocument(user, role.name);
    await assertTenantLibraryActive(user.libraryId ? String(user.libraryId) : null, role.name);
    const tokens = await issueTokensForUser(user, role.name, device);

    const safe = toSafeUser(user, role);
    return { user: await attachStudentIdForStudentRole(safe, String(user._id)), tokens };
  }

  /**
   * Logout current session (or all sessions if `allDevices` is true).
   */
  async logout(
    userId: string | Types.ObjectId,
    refreshToken: string | undefined,
    allDevices: boolean,
  ): Promise<void> {
    if (allDevices) {
      await UserModel.updateOne({ _id: userId }, { $set: { refreshTokens: [] } });
      return;
    }

    if (!refreshToken) {
      // Nothing to revoke server-side, but client cookies will be cleared.
      return;
    }
    const hash = hashRefreshToken(refreshToken);
    await UserModel.updateOne(
      { _id: userId },
      { $pull: { refreshTokens: { tokenHash: hash } } },
    );
  }

  /**
   * Returns the currently authenticated user (with permissions).
   */
  async getCurrentUser(userId: string): Promise<SafeUser> {
    const user = await UserModel.findById(userId).populate({
      path: 'role',
      populate: { path: 'permissions', select: 'name' },
    });

    if (!user) throw ApiError.unauthorized('User no longer exists');
    this.assertUserMayAuthenticate(user);

    const role = user.role as unknown as { name: RoleName; permissions: { name: string }[] };
    await applyResolvedTenantToUserDocument(user, role.name);
    await assertTenantLibraryActive(user.libraryId ? String(user.libraryId) : null, role.name);
    const safe = toSafeUser(user, role);
    return attachStudentIdForStudentRole(safe, String(user._id));
  }

  /**
   * Verifies that the required system roles exist (used for health checks).
   */
  async verifyRbacSeeded(): Promise<boolean> {
    const count = await RoleModel.countDocuments({ isSystem: true });
    return count >= Object.keys(ROLES).length;
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    const user = await UserModel.findOne({ email: input.email }).select(
      '+resetPasswordTokenHash +resetPasswordExpiresAt',
    );
    if (!user || !user.isActive) return;

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + AUTH_CONSTANTS.RESET_PASSWORD_TTL_MS);

    user.resetPasswordTokenHash = tokenHash;
    user.resetPasswordExpiresAt = expiresAt;
    await user.save();

    const resetUrl = `${ENV.FRONTEND_URL}/reset-password?token=${encodeURIComponent(rawToken)}`;
    if (!ENV.SMTP_CONFIGURED && !ENV.IS_PROD) {
      // eslint-disable-next-line no-console
      console.info(`[auth] Password reset link for ${user.email}: ${resetUrl}`);
    }
    await sendPasswordResetEmail(user.email, user.fullName, resetUrl);
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    currentRefreshToken?: string,
  ): Promise<void> {
    const user = await UserModel.findById(userId).select(
      '+passwordHash +refreshTokens',
    );
    if (!user) throw ApiError.unauthorized('User no longer exists');

    const valid = await user.comparePassword(input.currentPassword);
    if (!valid) {
      throw ApiError.badRequest('Current password is incorrect');
    }

    user.passwordHash = await UserModel.hashPassword(input.newPassword);

    if (currentRefreshToken) {
      const keepHash = hashRefreshToken(currentRefreshToken);
      user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash === keepHash);
    } else {
      user.refreshTokens = [];
    }

    await user.save();
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashResetToken(input.token);
    const user = await UserModel.findOne({ resetPasswordTokenHash: tokenHash }).select(
      '+passwordHash +resetPasswordTokenHash +resetPasswordExpiresAt +refreshTokens',
    );

    if (!user || !user.resetPasswordExpiresAt) {
      throw ApiError.badRequest(AUTH_CONSTANTS.RESET_PASSWORD_INVALID_MSG);
    }

    if (user.resetPasswordExpiresAt.getTime() < Date.now()) {
      user.resetPasswordTokenHash = null;
      user.resetPasswordExpiresAt = null;
      await user.save();
      throw ApiError.badRequest(AUTH_CONSTANTS.RESET_PASSWORD_INVALID_MSG);
    }

    user.passwordHash = await UserModel.hashPassword(input.password);
    user.resetPasswordTokenHash = null;
    user.resetPasswordExpiresAt = null;
    user.refreshTokens = [];
    await user.save();
  }
}

export const authService = new AuthService();

/** Re-exported for tests. */
export const __testables = { hashRefreshToken, hashResetToken, parseDurationToMs };
