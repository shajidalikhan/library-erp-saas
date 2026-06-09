'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';

type Nav = { href: string; label: string; visible: (p: ReturnType<typeof usePermissions>) => boolean };

const NAV: Nav[] = [
  { href: ROUTES.ANALYTICS, label: 'Overview', visible: () => true },
  {
    href: ROUTES.ANALYTICS_REVENUE,
    label: 'Revenue',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.ANALYTICS_STUDENTS,
    label: 'Students',
    visible: (p) => p.can(PERMISSIONS.STUDENT_READ),
  },
  {
    href: ROUTES.ANALYTICS_SEATS,
    label: 'Seats',
    visible: (p) => p.canAny([PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ]),
  },
  {
    href: ROUTES.ANALYTICS_ATTENDANCE,
    label: 'Attendance',
    visible: (p) => p.can(PERMISSIONS.ATTENDANCE_READ),
  },
  {
    href: ROUTES.ANALYTICS_PAYMENTS,
    label: 'Payments',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.ANALYTICS_BRANCHES,
    label: 'Branches',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
];

export function AnalyticsSubNav() {
  const pathname = usePathname();
  const perms = usePermissions();
  const items = NAV.filter((n) => n.visible(perms));

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Analytics sections">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            (pathname === item.href ||
              (item.href !== ROUTES.ANALYTICS && pathname.startsWith(item.href + '/')))
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
