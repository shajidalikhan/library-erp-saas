import { ROLES } from '@/constants/permissions';
import type { PermissionName } from '@/constants/permissions';
import {
  MODULE_SUBSCRIPTION_FEATURE,
  PERMISSION_CAPABILITY_MAP,
} from '@/lib/capability-constants';
import type { RoleCapabilityModule } from '@/types/auth';

export type CapabilityDenySource = 'rbac' | 'role_capability' | 'subscription' | 'ok';

export type CapabilityCheckResult = {
  allowed: boolean;
  reason: string;
  source: CapabilityDenySource;
  upgradeRequired: boolean;
};

export type RoleCapabilities = Partial<
  Record<RoleCapabilityModule, Record<string, boolean>>
>;

const bypassRoles = new Set<string>([ROLES.SUPER_ADMIN, ROLES.LIBRARY_OWNER]);

const capabilityBypassRoles = (module: RoleCapabilityModule, role?: string | null): boolean => {
  if (role === ROLES.SUPER_ADMIN) return true;
  if (module === 'public_booking') return false;
  return role != null && bypassRoles.has(role);
};

function isActionEnabled(
  capabilities: RoleCapabilities | undefined,
  module: RoleCapabilityModule,
  action: string,
  roleModules?: Record<RoleCapabilityModule, boolean>,
): boolean {
  if (capabilities && module in capabilities) {
    const mod = capabilities[module]!;
    if (action in mod) return Boolean(mod[action]);
    return false;
  }
  if (roleModules !== undefined) {
    if (roleModules[module] === false) return false;
    if (roleModules[module] === true) return true;
  }
  return true;
}

export function canUseModule(
  opts: {
    role?: string | null;
    module: RoleCapabilityModule;
    action?: string;
    permission?: PermissionName | PermissionName[];
    permissions?: PermissionName[];
    subscriptionFeatures?: Record<string, boolean>;
    roleCapabilities?: RoleCapabilities;
    roleModules?: Record<RoleCapabilityModule, boolean>;
  },
): CapabilityCheckResult {
  const {
    role,
    module,
    action = 'view',
    permission,
    permissions = [],
    subscriptionFeatures,
    roleCapabilities,
    roleModules,
  } = opts;

  if (role && capabilityBypassRoles(module, role)) {
    return { allowed: true, reason: '', source: 'ok', upgradeRequired: false };
  }

  const isPublicBooking = module === 'public_booking';

  const perms = permission
    ? Array.isArray(permission)
      ? permission
      : [permission]
    : [];
  if (perms.length > 0) {
    const hasPerm = perms.some((p) => permissions.includes(p));
    if (!hasPerm) {
      return {
        allowed: false,
        reason: isPublicBooking
          ? 'You do not have permission to manage public bookings.'
          : 'You do not have access to this feature.',
        source: 'rbac',
        upgradeRequired: false,
      };
    }
  }

  if (roleModules && roleModules[module] === false) {
    return {
      allowed: false,
      reason: isPublicBooking
        ? 'Public Booking is disabled for your role.'
        : 'You do not have access to this feature.',
      source: 'role_capability',
      upgradeRequired: false,
    };
  }

  if (roleCapabilities && !isActionEnabled(roleCapabilities, module, action, roleModules)) {
    return {
      allowed: false,
      reason: isPublicBooking
        ? 'Public Booking is disabled for your role.'
        : 'You do not have access to this feature.',
      source: 'role_capability',
      upgradeRequired: false,
    };
  }

  const subKey = MODULE_SUBSCRIPTION_FEATURE[module];
  if (subKey && subscriptionFeatures && !subscriptionFeatures[subKey]) {
    return {
      allowed: false,
      reason: isPublicBooking
        ? 'Your current subscription plan does not include Public Booking.'
        : 'Your subscription plan does not include this feature.',
      source: 'subscription',
      upgradeRequired: true,
    };
  }

  return { allowed: true, reason: '', source: 'ok', upgradeRequired: false };
}

export function canUseAction(
  module: RoleCapabilityModule,
  action: string,
  ctx: Parameters<typeof canUseModule>[0],
): CapabilityCheckResult {
  return canUseModule({ ...ctx, module, action });
}

export function canUsePermission(
  permission: PermissionName,
  ctx: Omit<Parameters<typeof canUseModule>[0], 'module' | 'action' | 'permission'>,
): CapabilityCheckResult {
  const mapped = PERMISSION_CAPABILITY_MAP[permission];
  if (!mapped) {
    const hasPerm = ctx.permissions?.includes(permission);
    if (!hasPerm && ctx.role && !bypassRoles.has(ctx.role)) {
      return {
        allowed: false,
        reason: 'You do not have access to this feature.',
        source: 'rbac',
        upgradeRequired: false,
      };
    }
    return { allowed: true, reason: '', source: 'ok', upgradeRequired: false };
  }
  return canUseModule({
    ...ctx,
    module: mapped.module,
    action: mapped.action,
    permission,
  });
}
