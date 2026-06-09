'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { membershipApi } from '@/modules/membership/membership.service';

const filterHref = (params: Record<string, string>) => {
  const q = new URLSearchParams(params).toString();
  return `${ROUTES.STUDENTS}?${q}`;
};

export function MembershipDashboardCards({ branchId }: { branchId?: string }) {
  const q = useQuery({
    queryKey: ['membership-dashboard', branchId],
    queryFn: () => membershipApi.dashboard(branchId ? { branchId } : undefined),
  });

  if (q.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const s = q.data;
  const cards = [
    {
      label: 'Active members',
      value: s?.active ?? 0,
      href: filterHref({ membershipStatus: 'ACTIVE' }),
      tone: 'text-emerald-600',
    },
    {
      label: 'Expired / suspended',
      value: s?.expired ?? 0,
      href: filterHref({ membershipStatus: 'SUSPENDED' }),
      tone: 'text-destructive',
    },
    {
      label: 'Expiring in 1–3 days',
      value: s?.expiring1to3 ?? 0,
      href: filterHref({ expiringIn: '1-3' }),
      tone: 'text-amber-600',
    },
    {
      label: 'Expiring in 4–7 days',
      value: s?.expiring4to7 ?? 0,
      href: filterHref({ expiringIn: '4-7' }),
      tone: 'text-orange-600',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Link key={c.label} href={c.href}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold tabular-nums ${c.tone}`}>{c.value}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
