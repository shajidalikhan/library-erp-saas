'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/constants/routes';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';

type Nav = { href: string; label: string; visible: (p: ReturnType<typeof usePermissions>, role?: string | null) => boolean };

const NAV: Nav[] = [
  { href: ROUTES.REPORTS, label: 'Overview', visible: () => true },
  {
    href: ROUTES.REPORTS_STUDENTS,
    label: 'Students',
    visible: (p, role) => p.can(PERMISSIONS.STUDENT_READ) && role !== ROLES.ACCOUNTANT,
  },
  {
    href: ROUTES.REPORTS_ATTENDANCE,
    label: 'Attendance',
    visible: (p, role) => p.can(PERMISSIONS.ATTENDANCE_READ) && role !== ROLES.ACCOUNTANT,
  },
  {
    href: ROUTES.REPORTS_SEATS,
    label: 'Seats',
    visible: (p, role) => p.canAny([PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ]) && role !== ROLES.ACCOUNTANT,
  },
  {
    href: ROUTES.REPORTS_PAYMENTS,
    label: 'Payments',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.REPORTS_INVOICES,
    label: 'Invoices',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.REPORTS_DUES,
    label: 'Dues',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.REPORTS_COLLECTIONS,
    label: 'Collections',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.REPORTS_BRANCHES,
    label: 'Branches',
    visible: (p) => p.canAny([PERMISSIONS.BRANCH_READ, PERMISSIONS.PAYMENT_READ]),
  },
];

export function ReportsSubNav() {
  const pathname = usePathname();
  const perms = usePermissions();
  const role = useAuthStore((s) => s.user?.role ?? null);
  const items = NAV.filter((n) => n.visible(perms, role));

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Reports sections">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            pathname === item.href || (item.href !== ROUTES.REPORTS && pathname.startsWith(item.href + '/'))
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
