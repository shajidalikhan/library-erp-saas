'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { ReportTableCard } from '@/modules/reports/components/report-table-card';
import { ReportsFiltersBar } from '@/modules/reports/components/reports-filters-bar';
import { reportsApi } from '@/modules/reports/reports.service';
import { reportsQueryKeys } from '@/modules/reports/reports-query-keys';
import { useReportsScope } from '@/modules/reports/use-reports-scope';

export default function ReportsBranchesPage() {
  const { can, canAny } = usePermissions();
  const allowed =
    canAny([PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW]) &&
    canAny([PERMISSIONS.BRANCH_READ, PERMISSIONS.PAYMENT_READ]);

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

  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => ({ ...listParams, page, limit: 20, sortBy: 'branchName', sortOrder: 'asc' as const }), [listParams, page]);

  const qEnabled = allowed && scopedQueryEnabled;

  const q = useQuery({
    queryKey: reportsQueryKeys.branches(queryParams),
    queryFn: () => reportsApi.branches(queryParams),
    enabled: qEnabled,
  });

  if (!allowed) return <p className="text-sm text-muted-foreground">No access to this report.</p>;

  const pg = q.data?.meta.pagination;
  const totalPages = pg?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch report"
        description="Headcount, configured seats, occupancy signals, and collections in the selected range."
      />
      <ReportsFiltersBar
        isSuper={isSuper}
        libraryId={libraryId}
        branchId={branchId}
        range={range}
        fromDate={fromDate}
        toDate={toDate}
        onLibraryChange={setLibraryId}
        onBranchChange={setBranchId}
        onRangeChange={(r) => {
          setRange(r);
          setPage(1);
        }}
        onFromDateChange={setFromDate}
        onToDateChange={setToDate}
      />
      {isSuper && !libraryId ? (
        <p className="text-sm text-muted-foreground">Select library workspace to load data.</p>
      ) : !scopedQueryEnabled && range === 'custom' ? (
        <p className="text-sm text-muted-foreground">Pick from and to dates for a custom range.</p>
      ) : q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Failed to load report.</p>
      ) : (
        <ReportTableCard
          title="Branches"
          columns={[
            { key: 'branchName', label: 'Branch' },
            { key: 'branchCode', label: 'Code' },
            { key: 'studentCount', label: 'Students' },
            { key: 'seatCount', label: 'Seats' },
            { key: 'occupiedSeats', label: 'Occupied' },
            { key: 'collectionInRange', label: 'Collections' },
            { key: 'paymentCountInRange', label: 'Payments' },
          ]}
          rows={q.data?.items ?? []}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
