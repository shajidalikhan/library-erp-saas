'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { ReportsFiltersBar } from '@/modules/reports/components/reports-filters-bar';
import { reportsApi } from '@/modules/reports/reports.service';
import { reportsQueryKeys } from '@/modules/reports/reports-query-keys';
import { useReportsScope } from '@/modules/reports/use-reports-scope';

export default function ReportsCollectionsPage() {
  const { can, canAny } = usePermissions();
  const allowed = canAny([PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW]) && can(PERMISSIONS.PAYMENT_READ);

  const {
    isSuper,
    libraryId,
    branchId,
    range,
    fromDate,
    toDate,
    setLibraryId,
    setBranchId,
    setRange,
    setFromDate,
    setToDate,
    listParams,
    scopedQueryEnabled,
  } = useReportsScope();

  const queryParams = useMemo(() => ({ ...listParams }), [listParams]);
  const qEnabled = allowed && scopedQueryEnabled;

  const daily = useQuery({
    queryKey: reportsQueryKeys.collectionsDaily(queryParams),
    queryFn: () => reportsApi.collectionsDaily(queryParams),
    enabled: qEnabled,
  });

  const monthly = useQuery({
    queryKey: reportsQueryKeys.collectionsMonthly(queryParams),
    queryFn: () => reportsApi.collectionsMonthly(queryParams),
    enabled: qEnabled,
  });

  if (!allowed) return <p className="text-sm text-muted-foreground">No access to this report.</p>;

  return (
    <div className="space-y-6">
      <PageHeader title="Collections" description="Aggregated cash-in from posted payments (UTC buckets)." />
      <ReportsFiltersBar
        isSuper={isSuper}
        libraryId={libraryId}
        branchId={branchId}
        range={range}
        fromDate={fromDate}
        toDate={toDate}
        onLibraryChange={setLibraryId}
        onBranchChange={setBranchId}
        onRangeChange={setRange}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
      />
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <div className="text-sm text-muted-foreground">
          Range applied:{' '}
          <span className="font-medium text-foreground">
            {daily.data?.range.from?.slice(0, 10) ?? '—'} → {daily.data?.range.to?.slice(0, 10) ?? '—'}
          </span>
        </div>
      </div>
      {isSuper && !libraryId ? (
        <p className="text-sm text-muted-foreground">Select library workspace to load data.</p>
      ) : !scopedQueryEnabled && range === 'custom' ? (
        <p className="text-sm text-muted-foreground">Pick from and to dates for a custom range.</p>
      ) : daily.isLoading || monthly.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : daily.isError || monthly.isError ? (
        <p className="text-sm text-destructive">Failed to load collections.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily totals</CardTitle>
              <p className="text-xs text-muted-foreground">
                Sum in range: {String(daily.data?.totalAmount ?? 0)}
              </p>
            </CardHeader>
            <CardContent className="max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(daily.data?.series ?? []).map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="text-sm">{r.date}</TableCell>
                      <TableCell className="text-right text-sm">{r.amount}</TableCell>
                      <TableCell className="text-right text-sm">{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly totals</CardTitle>
              <p className="text-xs text-muted-foreground">
                Sum in range: {String(monthly.data?.totalAmount ?? 0)}
              </p>
            </CardHeader>
            <CardContent className="max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(monthly.data?.series ?? []).map((r) => (
                    <TableRow key={r.month}>
                      <TableCell className="text-sm">{r.month}</TableCell>
                      <TableCell className="text-right text-sm">{r.amount}</TableCell>
                      <TableCell className="text-right text-sm">{r.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
