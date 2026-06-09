import { ROLES, type PermissionName, type RoleName } from '@/constants/permissions';

import { hasAnyPermission } from '@/lib/permissions';

import { hasEffectiveFeature } from '@/lib/effective-features';

import {

  evaluatePublicBookingNavVisibility,

  logPublicBookingNavDebug,

  PUBLIC_BOOKING_FEATURE_KEY,

} from '@/lib/public-booking-nav';

import type { AuthUser } from '@/types/auth';

import { PRIMARY_NAV, type NavItem, type NavSection } from '@/constants/navigation';

import { SUBSCRIPTION_FEATURE_KEYS } from '@/modules/subscription/subscription-feature-catalog';

import { canUseModule } from '@/lib/capability';

import { ROLE_CAPABILITY_MODULES } from '@/lib/role-capabilities';

import type { RoleCapabilities, RoleCapabilityModule } from '@/types/auth';



const ALL_SUBSCRIPTION_FEATURES_TRUE = Object.fromEntries(

  SUBSCRIPTION_FEATURE_KEYS.map((key) => [key, true]),

) as Record<string, boolean>;



export type NavigationFilterContext = {

  role?: string | null;

  permissions: PermissionName[];

  subscriptionFeatures?: Record<string, boolean>;

  enabledFeaturesOverride?: string[];

  disabledFeaturesOverride?: string[];

  roleCapabilities?: RoleCapabilities;

  roleModules?: Record<RoleCapabilityModule, boolean>;

  libraryId?: string | null;

  /** Capability preview: ignore plan limits so toggles reflect nav gating only. */

  assumeAllSubscriptionFeatures?: boolean;

};



export function deriveModuleFlagsFromCapabilities(

  capabilities: RoleCapabilities | undefined,

): Record<RoleCapabilityModule, boolean> {

  return Object.fromEntries(

    ROLE_CAPABILITY_MODULES.map((mod) => [

      mod,

      Object.values(capabilities?.[mod] ?? {}).some(Boolean),

    ]),

  ) as Record<RoleCapabilityModule, boolean>;

}



export function canShowNavigationItem(item: NavItem, ctx: NavigationFilterContext): boolean {

  const bypassFeatures = ctx.role === ROLES.SUPER_ADMIN;

  const userForPerm = ctx.role

    ? ({ role: ctx.role, permissions: ctx.permissions } as Pick<AuthUser, 'role' | 'permissions'>)

    : null;



  if (item.rolesOnly?.length && ctx.role && !item.rolesOnly.includes(ctx.role as RoleName)) {

    return false;

  }



  if (item.tenantHref && !ctx.libraryId) return false;



  const subscriptionFeatures = ctx.assumeAllSubscriptionFeatures

    ? ALL_SUBSCRIPTION_FEATURES_TRUE

    : ctx.subscriptionFeatures;



  // Must run before generic `item.permissions` check: owners bypass booking
  // permissions in evaluatePublicBookingNavVisibility, but the nav item still
  // lists permissions that may be missing from a stale JWT until re-login.
  if (item.label === 'Public Booking') {
    const gateCtx = { ...ctx, subscriptionFeatures };
    const debug = evaluatePublicBookingNavVisibility(gateCtx);
    logPublicBookingNavDebug(gateCtx, debug);
    return debug.finalVisible;
  }



  if (item.permissions?.length && !hasAnyPermission(userForPerm, item.permissions)) {

    return false;

  }



  const featureKey = item.subscriptionFeature;

  if (

    featureKey &&

    !bypassFeatures &&

    ctx.libraryId &&

    !hasEffectiveFeature(subscriptionFeatures, featureKey)

  ) {

    return false;

  }



  const bypassRoleCapability =

    ctx.role === ROLES.SUPER_ADMIN ||

    (ctx.role === ROLES.LIBRARY_OWNER && item.roleModule !== PUBLIC_BOOKING_FEATURE_KEY);



  if (item.roleModule && !bypassRoleCapability) {

    const cap = canUseModule({

      role: ctx.role,

      module: item.roleModule,

      action: 'view',

      permissions: ctx.permissions,

      subscriptionFeatures,

      roleCapabilities: ctx.roleCapabilities,

      roleModules: ctx.roleModules,

    });

    if (!cap.allowed) return false;

  }



  return true;

}



export function filterVisibleNavSections(ctx: NavigationFilterContext): NavSection[] {

  return PRIMARY_NAV.map((section) => ({

    ...section,

    items: section.items.filter((item) => canShowNavigationItem(item, ctx)),

  })).filter((section) => section.items.length > 0);

}

