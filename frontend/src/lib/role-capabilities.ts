import type { RoleCapabilityModule } from '@/types/auth';

export const ROLE_CAPABILITY_MODULES: RoleCapabilityModule[] = [
  'students',
  'attendance',
  'seats',
  'shifts',
  'payments',
  'invoices',
  'dues',
  'reports',
  'analytics',
  'notifications',
  'settings',
  'public_booking',
];

/** Merge a single toggle into a full module map (no undefined values). */
export function mergeRoleModulePatch(
  current: Record<RoleCapabilityModule, boolean>,
  change: Partial<Record<RoleCapabilityModule, boolean>>,
): Record<RoleCapabilityModule, boolean> {
  const next = { ...current };
  for (const mod of ROLE_CAPABILITY_MODULES) {
    if (change[mod] !== undefined) {
      next[mod] = change[mod]!;
    }
  }
  return next;
}
