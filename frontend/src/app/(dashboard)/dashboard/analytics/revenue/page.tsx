'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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

export default function AnalyticsRevenuePage() {
  const { can, canAny } = usePermissions();
  const allowed = canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]) && can(PERMISSIONS.PAYMENT_READ);
  const { isSuper, libraryId, branchId, range, setLibraryId, setBranchId, setRange, params } =
    useAnalyticsScope();

  const q = useQuery({
    queryKey: analyticsQueryKeys.revenue(params),
    queryFn: () => analyticsApi.revenue(params),
    enabled: allowed,
  });

  const monthly = useQuery({
    queryKey: analyticsQueryKeys.trendsMonthly(params),
    queryFn: () => analyticsApi.trendsMonthly(params),
    enabled: allowed,
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">No payment access for revenue analytics.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Revenue analytics" description="Collections over time within your tenant scope." />
      <AnalyticsFiltersBar
        isSuper={isSuper}
        libraryId={libraryId}
        branchId={branchId}
        range={range}
        onLibraryChange={setLibraryId}
        onBranchChange={setBranchId}
        onRangeChange={setRange}
      />
      {q.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load revenue.</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Total in range</CardTitle>
              <CardDescription>
                {formatCurrency(q.data?.totalInRange ?? 0)} ({q.data?.range.from?.slice(0, 10)} →{' '}
                {q.data?.range.to?.slice(0, 10)})
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={q.data?.trend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="amount" stroke="hsl(221 83% 53%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly trend</CardTitle>
              <CardDescription>Revenue and attendance by calendar month.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              {monthly.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly.data?.series ?? []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar yAxisId="left" dataKey="revenue" fill="hsl(221 83% 53%)" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar
                      yAxisId="right"
                      dataKey="attendance"
                      fill="hsl(142 76% 36%)"
                      name="Attendance"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
