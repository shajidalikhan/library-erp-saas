import { PERMISSIONS, ROLES, type PermissionName } from '@/constants/permissions';
import { hasAnyPermission } from '@/lib/permissions';
import {
  applyFeatureOverrideLists,
  hasEffectiveFeature,
  PUBLIC_BOOKING_FEATURE_KEY,
  type FeatureOverrideContext,
} from '@/lib/effective-features';
import type { NavigationFilterContext } from '@/lib/can-show-navigation';
import type { AuthUser, RoleCapabilities } from '@/types/auth';

export { PUBLIC_BOOKING_FEATURE_KEY };

export const PUBLIC_BOOKING_NAV_PERMISSIONS: PermissionName[] = [
  PERMISSIONS.PUBLIC_PAGE_MANAGE,
  PERMISSIONS.PUBLIC_PAGE_READ,
  PERMISSIONS.BOOKING_READ,
  PERMISSIONS.BOOKING_MANAGE,
];

export function hasPublicBookingNavPermission(
  user: Pick<AuthUser, 'role' | 'permissions' | 'libraryId'> | null,
): boolean {
  if (!user) return false;
  if (user.role === ROLES.LIBRARY_OWNER && user.libraryId) return true;
  return hasAnyPermission(user, PUBLIC_BOOKING_NAV_PERMISSIONS);
}

export function hasPublicBookingNavCapability(
  ctx: Pick<NavigationFilterContext, 'role' | 'roleCapabilities' | 'roleModules'>,
): boolean {
  if (ctx.role === ROLES.SUPER_ADMIN || ctx.role === ROLES.LIBRARY_OWNER) return true;

  const mod = ctx.roleCapabilities?.public_booking;
  if (mod) {
    return Boolean(mod.view || mod.manage);
  }
  if (ctx.roleModules && 'public_booking' in ctx.roleModules) {
    return Boolean(ctx.roleModules.public_booking);
  }
  return false;
}

function overrideCtx(ctx: NavigationFilterContext): FeatureOverrideContext {
  return {
    enabledFeaturesOverride: ctx.enabledFeaturesOverride,
    disabledFeaturesOverride: ctx.disabledFeaturesOverride,
  };
}

export function hasPublicBookingNavFeature(ctx: NavigationFilterContext): boolean {
  if (ctx.role === ROLES.SUPER_ADMIN) return true;
  if (!ctx.libraryId) return false;
  return hasEffectiveFeature(
    ctx.subscriptionFeatures,
    PUBLIC_BOOKING_FEATURE_KEY,
    overrideCtx(ctx),
  );
}

export type PublicBookingNavGateDebug = {
  hasPermission: boolean;
  hasFeature: boolean;
  hasRoleCapability: boolean;
  finalVisible: boolean;
};

export function evaluatePublicBookingNavVisibility(
  ctx: NavigationFilterContext,
): PublicBookingNavGateDebug {
  const userForPerm = ctx.role
    ? ({
        role: ctx.role,
        permissions: ctx.permissions,
        libraryId: ctx.libraryId,
      } as Pick<AuthUser, 'role' | 'permissions' | 'libraryId'>)
    : null;
  const hasPermission = hasPublicBookingNavPermission(userForPerm);
  const hasFeature = hasPublicBookingNavFeature(ctx);
  const hasRoleCapability = hasPublicBookingNavCapability(ctx);
  const finalVisible = hasPermission && hasFeature && hasRoleCapability;

  return { hasPermission, hasFeature, hasRoleCapability, finalVisible };
}

export function logPublicBookingNavDebug(
  ctx: NavigationFilterContext,
  debug: PublicBookingNavGateDebug,
): void {
  if (process.env.NODE_ENV !== 'development') return;
  const features = applyFeatureOverrideLists(ctx.subscriptionFeatures ?? {}, overrideCtx(ctx));
  console.debug('[nav] Public Booking', {
    role: ctx.role,
    libraryId: ctx.libraryId,
    public_booking: features[PUBLIC_BOOKING_FEATURE_KEY],
    enabledOverrides: ctx.enabledFeaturesOverride,
    disabledOverrides: ctx.disabledFeaturesOverride,
    ...debug,
  });
}

export function defaultOwnerPublicBookingCapabilities(): RoleCapabilities['public_booking'] {
  return { view: true, manage: true, approve: true, convert: true };
}
