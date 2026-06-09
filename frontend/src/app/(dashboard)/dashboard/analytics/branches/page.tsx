'use client';

import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { analyticsApi } from '@/modules/analytics/analytics.service';
import { analyticsQueryKeys } from '@/modules/analytics/analytics-query-keys';
import { AnalyticsFiltersBar } from '@/modules/analytics/components/analytics-filters-bar';
import { useAnalyticsScope } from '@/modules/analytics/use-analytics-scope';

type BranchRow = {
  branchId: string;
  branchName: string;
  branchCode: string;
  studentCount: number;
  seatTotal: number;
  seatOccupied: number;
  occupancyPct: number;
  revenueInRange: number;
  attendanceSessionsInRange: number;
};

export default function AnalyticsBranchesPage() {
  const { can, canAny } = usePermissions();
  const allowed = canAny([PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORT_VIEW]) && can(PERMISSIONS.PAYMENT_READ);
  const { isSuper, libraryId, branchId, range, setLibraryId, setBranchId, setRange, params, scopedQueryEnabled } =
    useAnalyticsScope();

  const q = useQuery({
    queryKey: analyticsQueryKeys.branches(params),
    queryFn: () => analyticsApi.branches(params),
    enabled: allowed && scopedQueryEnabled,
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">No access to branch performance.</p>;
  }

  const rows = (q.data?.branches as BranchRow[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Branch performance" description="Students, seats, occupancy, revenue, and attendance." />
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
        <p className="text-sm text-muted-foreground">Select library workspace to compare branches.</p>
      ) : q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load branch analytics.</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branches</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Seats</TableHead>
                  <TableHead className="text-right">Occ. %</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.branchId}>
                    <TableCell>
                      <div className="font-medium">{r.branchName}</div>
                      <div className="text-xs text-muted-foreground">{r.branchCode}</div>
                    </TableCell>
                    <TableCell className="text-right">{r.studentCount}</TableCell>
                    <TableCell className="text-right">
                      {r.seatOccupied}/{r.seatTotal}
                    </TableCell>
                    <TableCell className="text-right">{r.occupancyPct}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.revenueInRange)}</TableCell>
                    <TableCell className="text-right">{r.attendanceSessionsInRange}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
