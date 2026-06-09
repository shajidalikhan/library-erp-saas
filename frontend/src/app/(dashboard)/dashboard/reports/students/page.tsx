'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { useDebounce } from '@/hooks/use-debounce';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { ReportsExportToolbar } from '@/modules/reports/components/reports-export-toolbar';
import { ReportTableCard } from '@/modules/reports/components/report-table-card';
import { ReportsFiltersBar } from '@/modules/reports/components/reports-filters-bar';
import { useReportColumns } from '@/modules/reports/hooks/use-report-columns';
import { mapStudentPreviewRow, reportPreviewColumns } from '@/modules/reports/report-column-definitions';
import { reportsApi } from '@/modules/reports/reports.service';
import { reportsQueryKeys } from '@/modules/reports/reports-query-keys';
import { useReportsScope } from '@/modules/reports/use-reports-scope';

export default function ReportsStudentsPage() {
  const { can, canAny } = usePermissions();
  const role = useAuthStore((s) => s.user?.role);
  const allowed =
    canAny([PERMISSIONS.REPORT_VIEW, PERMISSIONS.ANALYTICS_VIEW]) &&
    can(PERMISSIONS.STUDENT_READ) &&
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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const queryParams = useMemo(
    () => ({
      ...listParams,
      page,
      limit: 20,
      search: debouncedSearch.trim() || undefined,
      sortBy,
      sortOrder,
    }),
    [listParams, page, debouncedSearch, sortBy, sortOrder],
  );

  const qEnabled = allowed && scopedQueryEnabled;
  const reportColumns = useReportColumns('students');
  const previewColumns = reportPreviewColumns('students', reportColumns.selectedKeys);

  const q = useQuery({
    queryKey: reportsQueryKeys.students(queryParams),
    queryFn: () => reportsApi.students(queryParams),
    enabled: qEnabled,
  });

  if (!allowed) {
    return <p className="text-sm text-muted-foreground">No access to this report.</p>;
  }

  const pg = q.data?.meta.pagination;
  const totalPages = pg?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Student report" description="Tenant-scoped student listing with CSV, Excel, and PDF exports." />
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
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[200px] flex-1 space-y-2">
          <Label htmlFor="rep-stu-search">Search</Label>
          <Input
            id="rep-stu-search"
            placeholder="Name, ID, email…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="min-w-[140px] space-y-2">
          <Label htmlFor="rep-stu-sort">Sort by</Label>
          <select
            id="rep-stu-sort"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="createdAt">Created</option>
            <option value="fullName">Name</option>
            <option value="admissionDate">Admission</option>
            <option value="studentId">Student ID</option>
            <option value="status">Status</option>
            <option value="email">Email</option>
          </select>
        </div>
        <div className="min-w-[120px] space-y-2">
          <Label htmlFor="rep-stu-order">Order</Label>
          <select
            id="rep-stu-order"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Export</Label>
          <ReportsExportToolbar
            report="students"
            exportPath="/reports/students/export"
            fileBaseName="students-report"
            params={queryParams}
            disabled={!qEnabled || q.isFetching}
            columns={reportColumns}
          />
        </div>
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
          rows={(q.data?.items ?? []).map((r) => mapStudentPreviewRow(r as Record<string, unknown>))}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
