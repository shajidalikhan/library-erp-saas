import { ApiError } from '@/lib/api-error';

export type FeatureAccessResult = {
  allowed: boolean;
  reason: string;
  upgradeRequired: boolean;
};

import type { RoleCapabilityModule } from '@/types/auth';

const NAV_FEATURE_TO_MODULE: Record<string, RoleCapabilityModule> = {
  seat_management: 'seats',
  shift_management: 'shifts',
  attendance: 'attendance',
  payments: 'payments',
  invoices: 'invoices',
  dues: 'dues',
  reports: 'reports',
  analytics: 'analytics',
  notifications: 'notifications',
  multi_branch: 'settings',
  public_booking: 'public_booking',
};

/** Client-side gate: subscription + role capability + RBAC permission. */
export function canUseFeature(
  features: Record<string, boolean> | undefined,
  featureKey: string,
  hasPermission = true,
  planName = '',
  roleModules?: Record<RoleCapabilityModule, boolean>,
): FeatureAccessResult {
  if (!hasPermission) {
    return {
      allowed: false,
      reason: 'You do not have permission for this action.',
      upgradeRequired: false,
    };
  }
  const moduleKey = NAV_FEATURE_TO_MODULE[featureKey];
  if (moduleKey && roleModules && roleModules[moduleKey] === false) {
    return {
      allowed: false,
      reason: 'Your role does not have access to this module.',
      upgradeRequired: false,
    };
  }
  if (!features || !features[featureKey]) {
    const plan = planName ? ` (${planName})` : '';
    return {
      allowed: false,
      reason: `Your current subscription plan does not include this feature${plan}.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true, reason: '', upgradeRequired: false };
}

const FEATURE_BLOCKED_CODES = new Set(['FORBIDDEN', 'PLAN_FEATURE_BLOCKED', 'SUBSCRIPTION_FEATURE_BLOCKED']);

/** Map API 403 subscription feature errors to user-facing toast text. */
export function subscriptionFeatureErrorMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.isForbidden) return null;
  const details = err.details as { upgradeRequired?: boolean; featureLabel?: string } | undefined;
  if (details?.upgradeRequired || FEATURE_BLOCKED_CODES.has(err.code)) {
    return err.message || 'Your current subscription plan does not include this feature.';
  }
  if (err.message.toLowerCase().includes('subscription plan')) {
    return err.message;
  }
  return null;
}
