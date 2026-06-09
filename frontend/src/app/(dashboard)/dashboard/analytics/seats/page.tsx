'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { analyticsApi } from '@/modules/analytics/analytics.service';
import { analyticsQueryKeys } from '@/modules/analytics/analytics-query-keys';
import { AnalyticsFiltersBar } from '@/modules/analytics/components/analytics-filters-bar';
import { useAnalyticsScope } from '@/modules/analytics/use-analytics-scope';

export default function AnalyticsSeatsPage() {
  const { canAny } = usePermissions();
  const hasAnalytics = canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]);
  const hasSeat = canAny([PERMISSIONS.SEAT_READ, PERMISSIONS.SEAT_OCCUPANCY_READ]);
  const { isSuper, libraryId, branchId, range, setLibraryId, setBranchId, setRange, params, scopedQueryEnabled } =
    useAnalyticsScope();

  const q = useQuery({
    queryKey: analyticsQueryKeys.seats(params),
    queryFn: () => analyticsApi.seats(params),
    enabled: hasAnalytics && hasSeat && scopedQueryEnabled,
  });

  if (!hasAnalytics || !hasSeat) {
    return <p className="text-sm text-muted-foreground">No access to seat analytics.</p>;
  }

  const byFloor =
    (q.data?.byFloor as Array<{ floor: string; total: number; occupied: number }>)?.map((f) => ({
      ...f,
      available: Math.max(0, f.total - f.occupied),
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Seat analytics" description="Occupancy by floor and zone." />
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
        <p className="text-sm text-muted-foreground">Select library workspace to load seat analytics.</p>
      ) : q.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load seat analytics.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy by floor</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byFloor}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="floor" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="occupied" stackId="a" fill="hsl(221 83% 53%)" name="Occupied" />
                <Bar dataKey="available" stackId="a" fill="hsl(142 76% 36%)" name="Available" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
