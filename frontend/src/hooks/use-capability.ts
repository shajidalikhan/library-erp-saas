'use client';

import { useMemo } from 'react';

import { ROLES } from '@/constants/permissions';
import type { PermissionName } from '@/constants/permissions';
import {
  canUseAction,
  canUseModule,
  canUsePermission,
  type CapabilityCheckResult,
} from '@/lib/capability';
import type { RoleCapabilities, RoleCapabilityModule } from '@/types/auth';
import { usePermissions } from '@/hooks/use-permissions';
import { useSubscriptionFeatures } from '@/modules/subscription/hooks/use-subscription-features';
import { selectUser, useAuthStore } from '@/store/auth.store';

export function useCapability() {
  const user = useAuthStore(selectUser);
  const { can, canAny } = usePermissions();
  const permissions = user?.permissions ?? [];
  const { features, hasFeature } = useSubscriptionFeatures();

  const ctx = useMemo(
    () => ({
      role: user?.role,
      permissions,
      subscriptionFeatures: features,
      roleCapabilities: user?.roleCapabilities as RoleCapabilities | undefined,
      roleModules: user?.roleModules,
    }),
    [user?.role, user?.roleCapabilities, user?.roleModules, permissions, features],
  );

  const bypass = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.LIBRARY_OWNER;

  return {
    bypass,
    canUseModule: (
      module: RoleCapabilityModule,
      action = 'view',
      permission?: PermissionName | PermissionName[],
    ): CapabilityCheckResult =>
      bypass
        ? { allowed: true, reason: '', source: 'ok', upgradeRequired: false }
        : canUseModule({ ...ctx, module, action, permission }),

    canUseAction: (module: RoleCapabilityModule, action: string): CapabilityCheckResult =>
      bypass
        ? { allowed: true, reason: '', source: 'ok', upgradeRequired: false }
        : canUseAction(module, action, { ...ctx, module, action }),

    canUsePermission: (permission: PermissionName): CapabilityCheckResult =>
      bypass
        ? { allowed: true, reason: '', source: 'ok', upgradeRequired: false }
        : canUsePermission(permission, ctx),

    hasSubscriptionFeature: hasFeature,
    can,
    canAny,
  };
}
