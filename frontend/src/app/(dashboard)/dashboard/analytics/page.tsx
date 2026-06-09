'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { analyticsApi } from '@/modules/analytics/analytics.service';
import { analyticsQueryKeys } from '@/modules/analytics/analytics-query-keys';
import { AnalyticsFiltersBar } from '@/modules/analytics/components/analytics-filters-bar';
import { useAnalyticsScope } from '@/modules/analytics/use-analytics-scope';

export default function AnalyticsHubPage() {
  const { canAny, can } = usePermissions();
  const allowed = canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]);
  const { isSuper, libraryId, branchId, range, setLibraryId, setBranchId, setRange, params } =
    useAnalyticsScope();

  const overviewQ = useQuery({
    queryKey: analyticsQueryKeys.overview(params),
    queryFn: () => analyticsApi.overview(params),
    enabled: allowed,
  });

  const trendsQ = useQuery({
    queryKey: analyticsQueryKeys.trendsDaily(params),
    queryFn: () => analyticsApi.trendsDaily(params),
    enabled: allowed && can(PERMISSIONS.PAYMENT_READ),
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">You do not have access to analytics.</p>;
  }

  const o = overviewQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Operational and financial KPIs for your library, scoped by role and tenant."
      />

      <AnalyticsFiltersBar
        isSuper={isSuper}
        libraryId={libraryId}
        branchId={branchId}
        range={range}
        onLibraryChange={setLibraryId}
        onBranchChange={setBranchId}
        onRangeChange={setRange}
      />

      {overviewQ.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : overviewQ.isError ? (
        <p className="text-sm text-destructive">Could not load overview.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {can(PERMISSIONS.STUDENT_READ) && o?.totalStudents != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Students</CardDescription>
                  <CardTitle className="text-2xl">{o.totalStudents}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Active {o.activeStudents ?? 0} · Inactive {o.inactiveStudents ?? 0}
                </CardContent>
              </Card>
            ) : null}
            {canAny([PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ]) && o?.occupancyPct != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Seat occupancy</CardDescription>
                  <CardTitle className="text-2xl">{o.occupancyPct}%</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  {o.occupiedSeats ?? 0} / {o.totalSeats ?? 0} seats in use
                </CardContent>
              </Card>
            ) : null}
            {can(PERMISSIONS.ATTENDANCE_READ) && o?.todayAttendance != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Today&apos;s attendance</CardDescription>
                  <CardTitle className="text-2xl">{o.todayAttendance}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  Active check-ins: {o.activeCheckIns ?? 0}
                </CardContent>
              </Card>
            ) : null}
            {can(PERMISSIONS.PAYMENT_READ) && o?.monthlyRevenue != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Revenue (MTD)</CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(o.monthlyRevenue)}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Collected this month</CardContent>
              </Card>
            ) : null}
            {can(PERMISSIONS.PAYMENT_READ) && o?.pendingDues != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Pending dues</CardDescription>
                  <CardTitle className="text-2xl">{formatCurrency(o.pendingDues)}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Open invoice balances</CardContent>
              </Card>
            ) : null}
            {can(PERMISSIONS.PAYMENT_READ) && o?.overdueInvoices != null ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Overdue invoices</CardDescription>
                  <CardTitle className="text-2xl">{o.overdueInvoices}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">Past due with balance</CardContent>
              </Card>
            ) : null}
          </div>

          {isSuper && o?.platform ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Platform (super admin)</CardTitle>
                <CardDescription>Active libraries and trailing-365d payment volume.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Active libraries</p>
                  <p className="text-2xl font-semibold">{o.platform.activeLibraries}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Platform revenue (365d)</p>
                  <p className="text-2xl font-semibold">{formatCurrency(o.platform.platformRevenue365d)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Top library</p>
                  <p className="font-medium">{o.platform.topLibrariesByRevenue[0]?.name ?? '—'}</p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {can(PERMISSIONS.PAYMENT_READ) && trendsQ.data?.series?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue vs attendance (daily)</CardTitle>
                <CardDescription>Selected range from filters above.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendsQ.data.series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(221 83% 53%)"
                      fill="hsl(221 83% 53% / 0.15)"
                      name="Revenue"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="attendance"
                      stroke="hsl(142 76% 36%)"
                      fill="hsl(142 76% 36% / 0.12)"
                      name="Attendance"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : trendsQ.isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : null}
        </>
      )}
    </div>
  );
}
