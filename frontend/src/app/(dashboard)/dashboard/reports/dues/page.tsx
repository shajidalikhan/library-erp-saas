'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { ReportExportButtons } from '@/modules/reports/components/report-export-buttons';
import { ReportTableCard } from '@/modules/reports/components/report-table-card';
import { ReportsFiltersBar } from '@/modules/reports/components/reports-filters-bar';
import { reportsApi } from '@/modules/reports/reports.service';
import { reportsQueryKeys } from '@/modules/reports/reports-query-keys';
import { useReportsScope } from '@/modules/reports/use-reports-scope';

export default function ReportsDuesPage() {
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

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const queryParams = useMemo(
    () => ({ ...listParams, page, limit: 20, sortBy, sortOrder }),
    [listParams, page, sortBy, sortOrder],
  );

  const qEnabled = allowed && scopedQueryEnabled;

  const q = useQuery({
    queryKey: reportsQueryKeys.dues(queryParams),
    queryFn: () => reportsApi.dues(queryParams),
    enabled: qEnabled,
  });

  if (!allowed) return <p className="text-sm text-muted-foreground">No access to this report.</p>;

  const pg = q.data?.meta.pagination;
  const totalPages = pg?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Dues report" description="Invoices with a positive balance in unpaid states." />
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
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
        <div className="min-w-[140px] space-y-2">
          <label className="text-sm font-medium">Sort</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="dueDate">Due date</option>
            <option value="dueAmount">Due amount</option>
            <option value="invoiceNumber">Invoice</option>
          </select>
        </div>
        <div className="min-w-[120px] space-y-2">
          <label className="text-sm font-medium">Order</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
        <ReportExportButtons
          exportPath="/reports/dues/export"
          fileBaseName="dues-report"
          params={queryParams}
          disabled={!qEnabled || q.isFetching}
        />
      </div>
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
          title="Preview"
          columns={[
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'studentName', label: 'Student' },
            { key: 'dueAmount', label: 'Due' },
            { key: 'status', label: 'Status' },
            { key: 'dueDate', label: 'Due date' },
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
