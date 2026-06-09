'use client';

import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { analyticsApi } from '@/modules/analytics/analytics.service';
import { analyticsQueryKeys } from '@/modules/analytics/analytics-query-keys';
import { AnalyticsFiltersBar } from '@/modules/analytics/components/analytics-filters-bar';
import { useAnalyticsScope } from '@/modules/analytics/use-analytics-scope';

export default function AnalyticsAttendancePage() {
  const { canAny, can } = usePermissions();
  const allowed =
    canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]) && can(PERMISSIONS.ATTENDANCE_READ);
  const { isSuper, libraryId, branchId, range, setLibraryId, setBranchId, setRange, params, scopedQueryEnabled } =
    useAnalyticsScope();

  const q = useQuery({
    queryKey: analyticsQueryKeys.attendance(params),
    queryFn: () => analyticsApi.attendance(params),
    enabled: allowed && scopedQueryEnabled,
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">No access to attendance analytics.</p>;
  }

  const data = q.data as
    | {
        dailyTrend?: Array<{ date: string; sessions: number }>;
        averageDurationMinutes?: number;
        activeCheckIns?: number;
      }
    | undefined;
  const daily = data?.dailyTrend ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance analytics" description="Daily volumes, duration, and peak check-in hours." />
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
        <p className="text-sm text-muted-foreground">Select library workspace to load attendance analytics.</p>
      ) : q.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load attendance analytics.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Daily attendance</CardTitle>
              <CardDescription>Sessions recorded per day.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="sessions" stroke="hsl(262 83% 58%)" fill="hsl(262 83% 58% / 0.2)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Average duration</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {data?.averageDurationMinutes ?? 0} min
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active check-ins</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{data?.activeCheckIns ?? 0}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
