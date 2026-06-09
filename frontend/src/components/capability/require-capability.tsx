'use client';

import type { ReactNode } from 'react';

import type { PermissionName } from '@/constants/permissions';
import type { RoleCapabilityModule } from '@/types/auth';
import { useCapability } from '@/hooks/use-capability';

interface RequireCapabilityProps {
  module: RoleCapabilityModule;
  action?: string;
  permission?: PermissionName | PermissionName[];
  fallback?: ReactNode;
  children: ReactNode;
}

/** Hides children unless subscription + role capability + RBAC all pass. */
export function RequireCapability({
  module,
  action = 'view',
  permission,
  fallback = null,
  children,
}: RequireCapabilityProps) {
  const { canUseModule } = useCapability();
  const result = canUseModule(module, action, permission);
  if (!result.allowed) return <>{fallback}</>;
  return <>{children}</>;
}
