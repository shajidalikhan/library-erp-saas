'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { ReportsExportToolbar } from '@/modules/reports/components/reports-export-toolbar';
import { ReportTableCard } from '@/modules/reports/components/report-table-card';
import { useReportColumns } from '@/modules/reports/hooks/use-report-columns';
import { reportPreviewColumns } from '@/modules/reports/report-column-definitions';
import { ReportsFiltersBar } from '@/modules/reports/components/reports-filters-bar';
import { reportsApi } from '@/modules/reports/reports.service';
import { reportsQueryKeys } from '@/modules/reports/reports-query-keys';
import { useReportsScope } from '@/modules/reports/use-reports-scope';

export default function ReportsAttendancePage() {
  const { can, canAny } = usePermissions();
  const role = useAuthStore((s) => s.user?.role);
  const allowed =
    canAny([PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW]) &&
    can(PERMISSIONS.ATTENDANCE_READ) &&
    role !== ROLES.ACCOUNTANT;

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
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const queryParams = useMemo(
    () => ({ ...listParams, page, limit: 20, sortBy, sortOrder }),
    [listParams, page, sortBy, sortOrder],
  );

  const qEnabled = allowed && scopedQueryEnabled;
  const reportColumns = useReportColumns('attendance');
  const previewColumns = reportPreviewColumns('attendance', reportColumns.selectedKeys);

  const q = useQuery({
    queryKey: reportsQueryKeys.attendance(queryParams),
    queryFn: () => reportsApi.attendance(queryParams),
    enabled: qEnabled,
  });

  if (!allowed) return <p className="text-sm text-muted-foreground">No access to this report.</p>;

  const pg = q.data?.meta.pagination;
  const totalPages = pg?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance report" description="Check-ins and duration within the selected window." />
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
          <label className="text-sm font-medium">Sort by</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date">Date</option>
            <option value="checkInAt">Check-in</option>
            <option value="durationMinutes">Minutes</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div className="min-w-[120px] space-y-2">
          <label className="text-sm font-medium">Order</label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
        <ReportsExportToolbar
          report="attendance"
          exportPath="/reports/attendance/export"
          fileBaseName="attendance-report"
          params={queryParams}
          disabled={!qEnabled || q.isFetching}
          columns={reportColumns}
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
          columns={previewColumns}
          rows={q.data?.items ?? []}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
