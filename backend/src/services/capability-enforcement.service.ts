import { ROLES, type RoleName } from '@constants/roles.constants';
import type { PermissionName } from '@constants/permissions.constants';
import {
  MODULE_SUBSCRIPTION_FEATURE,
  PERMISSION_CAPABILITY_MAP,
  type ModuleAction,
  type RoleCapabilityActionMatrix,
} from '@constants/role-capability-actions.constants';
import {
  PUBLIC_BOOKING_ACCESS_MESSAGES,
  PUBLIC_BOOKING_CAPABILITY_MODULE,
} from '@constants/public-booking-access.constants';
import type { RoleCapabilityModule } from '@constants/role-capabilities.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { appendPlatformAuditLog } from '@modules/platform/platform-audit.service';
import { roleCapabilityService } from '@modules/platform/role-capability.service';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';

export type CapabilityDenySource = 'rbac' | 'role_capability' | 'subscription';

export type CapabilityCheckResult = {
  allowed: boolean;
  reason: string;
  source: CapabilityDenySource | 'ok';
};

const bypassRoles = new Set<RoleName>([ROLES.SUPER_ADMIN, ROLES.LIBRARY_OWNER]);

const capabilityBypassRoles = (module: RoleCapabilityModule): Set<RoleName> =>
  module === PUBLIC_BOOKING_CAPABILITY_MODULE
    ? new Set<RoleName>([ROLES.SUPER_ADMIN])
    : bypassRoles;

export async function evaluateCapabilityAccess(
  user: AuthenticatedUser,
  opts: {
    module: RoleCapabilityModule;
    action: string;
    permission?: PermissionName;
    libraryId?: string | null;
  },
): Promise<CapabilityCheckResult> {
  if (capabilityBypassRoles(opts.module).has(user.role)) {
    return { allowed: true, reason: '', source: 'ok' };
  }

  const isPublicBooking = opts.module === PUBLIC_BOOKING_CAPABILITY_MODULE;

  if (opts.permission && !user.permissions.includes(opts.permission)) {
    return {
      allowed: false,
      reason: isPublicBooking
        ? PUBLIC_BOOKING_ACCESS_MESSAGES.rbac
        : 'You do not have access to this feature.',
      source: 'rbac',
    };
  }

  const matrix = await roleCapabilityService.getActionMatrixForRole(user.role);
  const moduleActions = matrix[opts.module] as Record<string, boolean>;
  if (!moduleActions[opts.action]) {
    return {
      allowed: false,
      reason: isPublicBooking
        ? PUBLIC_BOOKING_ACCESS_MESSAGES.roleCapability
        : 'You do not have access to this feature.',
      source: 'role_capability',
    };
  }

  const subKey = MODULE_SUBSCRIPTION_FEATURE[opts.module];
  const libraryId = opts.libraryId ?? user.libraryId;
  if (subKey && libraryId) {
    const enabled = await subscriptionFeatureService.hasFeature(libraryId, subKey);
    if (!enabled) {
      return {
        allowed: false,
        reason: isPublicBooking
          ? PUBLIC_BOOKING_ACCESS_MESSAGES.subscription
          : 'Your subscription plan does not include this feature.',
        source: 'subscription',
      };
    }
  }

  return { allowed: true, reason: '', source: 'ok' };
}

export async function assertCapabilityAccess(
  user: AuthenticatedUser,
  opts: {
    module: RoleCapabilityModule;
    action: string;
    permission?: PermissionName;
    libraryId?: string | null;
    auditContext?: { ipAddress?: string; userAgent?: string };
  },
): Promise<void> {
  const result = await evaluateCapabilityAccess(user, opts);
  if (result.allowed) return;

  if (result.source === 'role_capability' || result.source === 'rbac') {
    await appendPlatformAuditLog({
      actorUserId: user.id,
      action: result.source === 'rbac' ? 'RBAC_DENIED' : 'ROLE_CAPABILITY_DENIED',
      entityType: 'CAPABILITY',
      libraryId: user.libraryId,
      branchId: user.branchId,
      metadata: {
        module: opts.module,
        action: opts.action,
        permission: opts.permission,
        reason: result.reason,
      },
      ipAddress: opts.auditContext?.ipAddress ?? null,
      userAgent: opts.auditContext?.userAgent ?? null,
    }).catch(() => undefined);
  }

  const code =
    result.source === 'subscription'
      ? 'SUBSCRIPTION_FEATURE_BLOCKED'
      : result.source === 'role_capability'
        ? 'ROLE_CAPABILITY_DENIED'
        : 'FORBIDDEN';

  throw ApiError.forbidden(result.reason, {
    code,
    module: opts.module,
    action: opts.action,
    upgradeRequired: result.source === 'subscription',
  });
}

export async function assertPermissionCapability(
  user: AuthenticatedUser,
  permission: PermissionName,
  libraryId?: string | null,
): Promise<void> {
  const mapped = PERMISSION_CAPABILITY_MAP[permission];
  if (!mapped) {
    if (!user.permissions.includes(permission) && !bypassRoles.has(user.role)) {
      throw ApiError.forbidden('You do not have access to this feature.');
    }
    return;
  }
  await assertCapabilityAccess(user, {
    module: mapped.module,
    action: mapped.action,
    permission,
    libraryId,
  });
}

export function resolveCapabilityFromPermission(
  permission: PermissionName,
): { module: RoleCapabilityModule; action: string } | null {
  return PERMISSION_CAPABILITY_MAP[permission] ?? null;
}

export type { RoleCapabilityActionMatrix, ModuleAction };
