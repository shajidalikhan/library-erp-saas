'use client';

import Link from 'next/link';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';

const CARDS: {
  href: string;
  title: string;
  description: string;
  visible: (p: ReturnType<typeof usePermissions>, role: string | null) => boolean;
}[] = [
  {
    href: ROUTES.REPORTS_STUDENTS,
    title: 'Students',
    description: 'Directory-style listing with filters and exports.',
    visible: (p, role) => p.can(PERMISSIONS.STUDENT_READ) && role !== ROLES.ACCOUNTANT,
  },
  {
    href: ROUTES.REPORTS_ATTENDANCE,
    title: 'Attendance',
    description: 'Check-ins, duration, and branch context.',
    visible: (p, role) => p.can(PERMISSIONS.ATTENDANCE_READ) && role !== ROLES.ACCOUNTANT,
  },
  {
    href: ROUTES.REPORTS_SEATS,
    title: 'Seats',
    description: 'Occupancy and assignment snapshot.',
    visible: (p, role) => p.canAny([PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ]) && role !== ROLES.ACCOUNTANT,
  },
  {
    href: ROUTES.REPORTS_PAYMENTS,
    title: 'Payments',
    description: 'Receipts and allocations in range.',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.REPORTS_INVOICES,
    title: 'Invoices',
    description: 'Issued invoices with balances.',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.REPORTS_DUES,
    title: 'Dues',
    description: 'Outstanding balances by invoice.',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.REPORTS_COLLECTIONS,
    title: 'Collections',
    description: 'Daily and monthly cash-in trends.',
    visible: (p) => p.can(PERMISSIONS.PAYMENT_READ),
  },
  {
    href: ROUTES.REPORTS_BRANCHES,
    title: 'Branches',
    description: 'Per-branch headcount, seats, and collections.',
    visible: (p) => p.canAny([PERMISSIONS.BRANCH_READ, PERMISSIONS.PAYMENT_READ]),
  },
];

export default function ReportsDashboardPage() {
  const perms = usePermissions();
  const role = useAuthStore((s) => s.user?.role ?? null);
  const allowed = perms.canAny([PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW]);

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">You do not have access to reports.</p>;
  }

  const items = CARDS.filter((c) => c.visible(perms, role));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational and finance exports scoped to your library and branch. Super admins must pick a library first."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <Link key={c.href} href={c.href} className="block transition-opacity hover:opacity-90">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-base">{c.title}</CardTitle>
                <CardDescription>{c.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
