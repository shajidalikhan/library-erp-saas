import { PERMISSIONS, ROLES, type PermissionName } from '@/constants/permissions';
import { ApiError } from '@/lib/api-error';
import { canUseModule } from '@/lib/capability';
import {
  hasEffectiveFeature,
  PUBLIC_BOOKING_FEATURE_KEY,
  type FeatureOverrideContext,
} from '@/lib/effective-features';
import {
  hasPublicBookingNavCapability,
  hasPublicBookingNavPermission,
} from '@/lib/public-booking-nav';
import { subscriptionFeatureErrorMessage } from '@/lib/feature-access';
import type { AuthUser } from '@/types/auth';

export { PUBLIC_BOOKING_FEATURE_KEY };

export const PUBLIC_BOOKING_MESSAGES = {
  rbac: 'You do not have permission to manage Public Booking.',
  subscription: 'Your current subscription plan does not include Public Booking.',
  roleCapability: 'Public Booking is disabled for your role.',
  page: 'You do not have access to Public Booking.',
} as const;

export type PublicBookingAccessOpts = {
  /** Merged plan + override flags (e.g. from `useSubscriptionFeatures`). */
  subscriptionFeatures?: Record<string, boolean>;
  enabledFeaturesOverride?: string[];
  disabledFeaturesOverride?: string[];
};

function isTenantLibraryOwner(user: AuthUser | null | undefined): boolean {
  return user?.role === ROLES.LIBRARY_OWNER && Boolean(user.libraryId);
}

function featureContext(
  user: AuthUser | null | undefined,
  opts?: PublicBookingAccessOpts,
): { features: Record<string, boolean> | undefined; overrides: FeatureOverrideContext } {
  const features =
    opts?.subscriptionFeatures ?? user?.effectiveFeatures ?? user?.subscriptionFeatures;
  return {
    features,
    overrides: {
      enabledFeaturesOverride:
        opts?.enabledFeaturesOverride ?? user?.enabledFeaturesOverride,
      disabledFeaturesOverride:
        opts?.disabledFeaturesOverride ?? user?.disabledFeaturesOverride,
    },
  };
}

function hasPublicBookingFeature(
  user: AuthUser | null | undefined,
  opts?: PublicBookingAccessOpts,
): boolean {
  const { features, overrides } = featureContext(user, opts);
  return hasEffectiveFeature(features, PUBLIC_BOOKING_FEATURE_KEY, overrides);
}

function capabilityCtx(user: AuthUser | null | undefined) {
  return {
    role: user?.role,
    roleCapabilities: user?.roleCapabilities,
    roleModules: user?.roleModules,
  };
}

function moduleCtx(user: AuthUser | null | undefined, opts?: PublicBookingAccessOpts) {
  const { features } = featureContext(user, opts);
  return {
    role: user?.role,
    module: 'public_booking' as const,
    permissions: user?.permissions ?? [],
    subscriptionFeatures: features,
    roleCapabilities: user?.roleCapabilities,
    roleModules: user?.roleModules,
  };
}

function denyCapability(): {
  allowed: false;
  reason: string;
  source: 'role_capability';
} {
  return {
    allowed: false,
    reason: PUBLIC_BOOKING_MESSAGES.roleCapability,
    source: 'role_capability',
  };
}

export function canAccessPublicBookingPage(
  user: AuthUser | null | undefined,
  opts?: PublicBookingAccessOpts,
) {
  if (!user) {
    return { allowed: false, reason: PUBLIC_BOOKING_MESSAGES.page, source: 'rbac' as const };
  }
  if (!hasPublicBookingNavPermission(user)) {
    return { allowed: false, reason: PUBLIC_BOOKING_MESSAGES.page, source: 'rbac' as const };
  }
  if (!hasPublicBookingFeature(user, opts)) {
    return {
      allowed: false,
      reason: PUBLIC_BOOKING_MESSAGES.subscription,
      source: 'subscription' as const,
    };
  }
  if (!hasPublicBookingNavCapability(capabilityCtx(user))) {
    return denyCapability();
  }

  if (isTenantLibraryOwner(user) || user.role === ROLES.SUPER_ADMIN) {
    return { allowed: true, reason: '', source: 'ok' as const };
  }

  const sub = canUseModule({
    ...moduleCtx(user, opts),
    action: 'view',
  });
  if (!sub.allowed) {
    return {
      allowed: false,
      reason:
        sub.source === 'subscription'
          ? PUBLIC_BOOKING_MESSAGES.subscription
          : sub.source === 'role_capability'
            ? PUBLIC_BOOKING_MESSAGES.roleCapability
            : PUBLIC_BOOKING_MESSAGES.page,
      source: sub.source,
    };
  }
  return { allowed: true, reason: '', source: 'ok' as const };
}

function mapModuleDeny(
  result: ReturnType<typeof canUseModule>,
  fallbackRbac: string,
): ReturnType<typeof canUseModule> {
  if (result.allowed) return result;
  return {
    ...result,
    reason:
      result.source === 'subscription'
        ? PUBLIC_BOOKING_MESSAGES.subscription
        : result.source === 'role_capability'
          ? PUBLIC_BOOKING_MESSAGES.roleCapability
          : fallbackRbac,
  };
}

export function canViewPublicBookingSettingsTab(
  user: AuthUser | null | undefined,
  opts?: PublicBookingAccessOpts,
) {
  if (!user) {
    return { allowed: false, reason: PUBLIC_BOOKING_MESSAGES.rbac, source: 'rbac' as const };
  }
  if (isTenantLibraryOwner(user)) {
    if (!hasPublicBookingFeature(user, opts)) {
      return {
        allowed: false,
        reason: PUBLIC_BOOKING_MESSAGES.subscription,
        source: 'subscription' as const,
      };
    }
    if (!hasPublicBookingNavCapability(capabilityCtx(user))) {
      return denyCapability();
    }
    return { allowed: true, reason: '', source: 'ok' as const };
  }
  if (!user.permissions.includes(PERMISSIONS.PUBLIC_PAGE_MANAGE)) {
    return { allowed: false, reason: PUBLIC_BOOKING_MESSAGES.rbac, source: 'rbac' as const };
  }
  return mapModuleDeny(
    canUseModule({
      ...moduleCtx(user, opts),
      action: 'manage',
      permission: PERMISSIONS.PUBLIC_PAGE_MANAGE,
    }),
    PUBLIC_BOOKING_MESSAGES.rbac,
  );
}

export function canViewPublicBookingListTab(
  user: AuthUser | null | undefined,
  opts?: PublicBookingAccessOpts,
) {
  if (!user) {
    return { allowed: false, reason: PUBLIC_BOOKING_MESSAGES.rbac, source: 'rbac' as const };
  }
  if (isTenantLibraryOwner(user)) {
    if (!hasPublicBookingFeature(user, opts)) {
      return {
        allowed: false,
        reason: PUBLIC_BOOKING_MESSAGES.subscription,
        source: 'subscription' as const,
      };
    }
    if (!hasPublicBookingNavCapability(capabilityCtx(user))) {
      return denyCapability();
    }
    return { allowed: true, reason: '', source: 'ok' as const };
  }
  const perms = user.permissions ?? [];
  const hasListPerm =
    perms.includes(PERMISSIONS.BOOKING_READ) || perms.includes(PERMISSIONS.BOOKING_MANAGE);
  if (!hasListPerm) {
    return { allowed: false, reason: PUBLIC_BOOKING_MESSAGES.rbac, source: 'rbac' as const };
  }
  return mapModuleDeny(
    canUseModule({
      ...moduleCtx(user, opts),
      action: 'view',
      permission: [PERMISSIONS.BOOKING_READ, PERMISSIONS.BOOKING_MANAGE],
    }),
    PUBLIC_BOOKING_MESSAGES.rbac,
  );
}

export function parsePublicBookingApiError(err: unknown): string | null {
  const sub = subscriptionFeatureErrorMessage(err);
  if (sub) return sub;
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'ROLE_CAPABILITY_DENIED') {
    return PUBLIC_BOOKING_MESSAGES.roleCapability;
  }
  const details = err.details as { requiredAny?: string[] } | undefined;
  if (
    err.isForbidden &&
    details?.requiredAny?.some((p) => p.startsWith('booking.') || p.startsWith('publicPage.'))
  ) {
    return PUBLIC_BOOKING_MESSAGES.rbac;
  }
  if (err.message.includes('Public Booking')) return err.message;
  if (err.message.includes('public bookings')) return err.message;
  return null;
}
