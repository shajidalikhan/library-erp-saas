'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { analyticsApi } from '@/modules/analytics/analytics.service';
import { analyticsQueryKeys } from '@/modules/analytics/analytics-query-keys';
import { AnalyticsFiltersBar } from '@/modules/analytics/components/analytics-filters-bar';
import { useAnalyticsScope } from '@/modules/analytics/use-analytics-scope';

export default function AnalyticsStudentsPage() {
  const { can, canAny } = usePermissions();
  const allowed =
    canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]) && can(PERMISSIONS.STUDENT_READ);
  const { isSuper, libraryId, branchId, range, setLibraryId, setBranchId, setRange, params, scopedQueryEnabled } =
    useAnalyticsScope();

  const q = useQuery({
    queryKey: analyticsQueryKeys.students(params),
    queryFn: () => analyticsApi.students(params),
    enabled: allowed && scopedQueryEnabled,
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">No access to student analytics.</p>;
  }

  const byBranch = (q.data?.byBranch as Array<{ branchName: string; count: number }>) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Student analytics" description="Branch mix, membership status, and intake trend." />
      <AnalyticsFiltersBar
        isSuper={isSuper}
        libraryId={libraryId}
        branchId={branchId}
        range={range}
        onLibraryChange={setLibraryId}
        onBranchChange={setBranchId}
        onRangeChange={setRange}
      />
      {isSuper && !libraryId ? (
        <p className="text-sm text-muted-foreground">Select library workspace to load student analytics.</p>
      ) : q.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load student analytics.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Students by branch</CardTitle>
            </CardHeader>
            <CardContent className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBranch}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="branchName" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(221 83% 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Membership status</CardTitle>
              <CardDescription>Headcount by student status.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {((q.data?.byMembershipStatus as Array<{ status: string; count: number }>) ?? []).map((r) => (
                  <li key={r.status} className="flex justify-between border-b py-1">
                    <span>{r.status}</span>
                    <span className="font-medium">{r.count}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Seat utilization (assigned / seats): {String(q.data?.seatUtilizationPct ?? '—')}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
