'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/constants/routes';
import { formatCurrency } from '@/lib/utils';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

export default function PlatformDashboardPage() {
  const q = useQuery({
    queryKey: platformQueryKeys.dashboard(),
    queryFn: () => platformApi.dashboard(),
  });

  const d = q.data as
    | {
        totalLibraries: number;
        activeLibraries: number;
        suspendedLibraries: number;
        trialLibraries: number;
        totalStudents: number;
        monthlyRevenue: number;
        activeUsers: number;
        trialsExpiring: number;
      }
    | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform control"
        description="Cross-tenant health, revenue, and trial signals for the Library ERP SaaS."
      />

      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load platform dashboard.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Libraries</CardDescription>
              <CardTitle className="text-2xl">{d?.totalLibraries ?? 0}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Active {d?.activeLibraries ?? 0} · Suspended {d?.suspendedLibraries ?? 0} · Trial{' '}
              {d?.trialLibraries ?? 0}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Students (all tenants)</CardDescription>
              <CardTitle className="text-2xl">{d?.totalStudents ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Monthly revenue</CardDescription>
              <CardTitle className="text-2xl">{formatCurrency(d?.monthlyRevenue ?? 0)}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Payments collected this calendar month.</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active users (30d)</CardDescription>
              <CardTitle className="text-2xl">{d?.activeUsers ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Trials expiring (7d)</CardDescription>
              <CardTitle className="text-2xl">{d?.trialsExpiring ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-dashed border-primary/35">
            <CardHeader className="pb-2">
              <CardDescription>Subscription invoices</CardDescription>
              <CardTitle className="text-base">SaaS billing</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <Button asChild variant="secondary" size="sm" className="mt-1">
                <Link href={ROUTES.PLATFORM_SUBSCRIPTION_INVOICES}>Manage invoices</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
