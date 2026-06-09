'use client';

import type { ReactNode } from 'react';

import { usePermissions } from '@/hooks/use-permissions';
import { useCapability } from '@/hooks/use-capability';
import type { PermissionName, RoleName } from '@/constants/permissions';

interface CanProps {
  /** Required permission(s). */
  permission?: PermissionName | PermissionName[];
  /** When passing an array, require ANY by default. Set `all` to require ALL. */
  all?: boolean;
  /** Optional role restriction. */
  role?: RoleName | RoleName[];
  /** Rendered when the check fails. Defaults to nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Declarative gate: RBAC permission + role capability action + subscription feature.
 */
export function Can({ permission, all, role, fallback = null, children }: CanProps) {
  const { can, canAll, canAny, hasRole } = usePermissions();
  const { canUsePermission, bypass } = useCapability();

  if (role) {
    const roles = Array.isArray(role) ? role : [role];
    if (!hasRole(...roles)) return <>{fallback}</>;
  }

  if (permission) {
    const perms = Array.isArray(permission) ? permission : [permission];
    if (bypass) {
      const ok = all ? canAll(perms) : perms.length === 1 ? can(perms[0]) : canAny(perms);
      if (!ok) return <>{fallback}</>;
    } else {
      const results = perms.map((p) => canUsePermission(p));
      const ok = all
        ? results.every((r) => r.allowed)
        : results.some((r) => r.allowed);
      if (!ok) return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
