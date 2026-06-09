'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { PRIMARY_NAV } from '@/constants/navigation';
import { ROUTES, libraryBranchesRoute, libraryDetailRoute } from '@/constants/routes';
import { ROLES, PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuth } from '@/hooks/use-auth';
import { useSubscriptionFeatures } from '@/modules/subscription/hooks/use-subscription-features';
import { canShowNavigationItem } from '@/lib/can-show-navigation';
import { selectUser, useAuthStore } from '@/store/auth.store';

interface SidebarNavProps {
  onItemClick?: () => void;
}

export function SidebarNav({ onItemClick }: SidebarNavProps) {
  const pathname = usePathname();
  const { canAny } = usePermissions();
  const user = useAuthStore(selectUser);
  const { refreshMe } = useAuth();
  const {
    features,
    enabledFeaturesOverride,
    disabledFeaturesOverride,
    refetch: refetchFeatures,
  } = useSubscriptionFeatures();

  useEffect(() => {
    if (!user?.libraryId) return;
    void refetchFeatures();
    void refreshMe().catch(() => undefined);
  }, [user?.libraryId, refetchFeatures, refreshMe]);

  useEffect(() => {
    if (!user?.libraryId) return;
    const onFocus = () => {
      void refetchFeatures();
      void refreshMe().catch(() => undefined);
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user?.libraryId, refetchFeatures, refreshMe]);

  const navCtx = {
    role: user?.role,
    permissions: user?.permissions ?? [],
    subscriptionFeatures: features,
    enabledFeaturesOverride,
    disabledFeaturesOverride,
    roleCapabilities: user?.roleCapabilities,
    roleModules: user?.roleModules,
    libraryId: user?.libraryId,
  };

  if (user?.role === ROLES.STUDENT) {
    const studentItems = [
      { label: 'My Profile', href: ROUTES.MY_PROFILE, permissions: [PERMISSIONS.ATTENDANCE_READ] },
      { label: 'My Attendance', href: ROUTES.MY_ATTENDANCE, permissions: [PERMISSIONS.ATTENDANCE_READ] },
      { label: 'My Payments', href: ROUTES.MY_PAYMENTS, permissions: [PERMISSIONS.PAYMENT_READ] },
      { label: 'My Seat', href: ROUTES.MY_SEAT, permissions: [PERMISSIONS.SEAT_READ] },
      { label: 'Notifications', href: ROUTES.NOTIFICATIONS, permissions: [PERMISSIONS.NOTIFICATION_READ] },
    ];
    return (
      <nav className="flex flex-col gap-2 px-3">
        {studentItems
          .filter((item) => canAny(item.permissions))
          .map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onItemClick}
                className={cn(
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-soft'
                    : 'text-sidebar-foreground/70',
                )}
              >
                {item.label}
              </Link>
            );
          })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-6 px-3">
      {PRIMARY_NAV.map((section, idx) => {
        const items = section.items.filter((item) => canShowNavigationItem(item, navCtx));
        if (items.length === 0) return null;

        return (
          <div key={section.label ?? idx} className="flex flex-col gap-1">
            {section.label ? (
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            {items.map(({ href, icon: Icon, label, badge, tenantHref, activeMatchPrefix }) => {
              const resolvedHref =
                tenantHref === 'branches' && user?.libraryId
                  ? libraryBranchesRoute(user.libraryId)
                  : tenantHref === 'library' && user?.libraryId
                    ? libraryDetailRoute(user.libraryId)
                    : href;
              const navKey = `${label}-${resolvedHref}`;
              const isActive =
                pathname === resolvedHref ||
                pathname.startsWith(`${resolvedHref}/`) ||
                (activeMatchPrefix
                  ? pathname === activeMatchPrefix || pathname.startsWith(`${activeMatchPrefix}/`)
                  : false) ||
                (tenantHref === 'branches' && user?.libraryId
                  ? pathname.startsWith(`${ROUTES.LIBRARIES}/${user.libraryId}/branches`)
                  : false) ||
                (tenantHref === 'library' && user?.libraryId
                  ? pathname.startsWith(`${ROUTES.LIBRARIES}/${user.libraryId}`) &&
                    !pathname.includes('/branches')
                  : false);
              return (
                <Link
                  key={navKey}
                  href={resolvedHref}
                  onClick={onItemClick}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-soft'
                      : 'text-sidebar-foreground/70',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{label}</span>
                  {badge ? (
                    <span className="ml-auto rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
