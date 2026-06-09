'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { PageHeader } from '@/components/common/page-header';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { ReportExportButtons } from '@/modules/reports/components/report-export-buttons';
import { ReportTableCard } from '@/modules/reports/components/report-table-card';
import { ReportsFiltersBar } from '@/modules/reports/components/reports-filters-bar';
import { reportsApi } from '@/modules/reports/reports.service';
import { reportsQueryKeys } from '@/modules/reports/reports-query-keys';
import { useReportsScope } from '@/modules/reports/use-reports-scope';

const STATUSES = ['', 'DRAFT', 'UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'] as const;

export default function ReportsInvoicesPage() {
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
  const [invoiceStatus, setInvoiceStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const queryParams = useMemo(
    () => ({
      ...listParams,
      page,
      limit: 20,
      invoiceStatus: invoiceStatus || undefined,
      sortBy,
      sortOrder,
    }),
    [listParams, page, invoiceStatus, sortBy, sortOrder],
  );

  const qEnabled = allowed && scopedQueryEnabled;

  const q = useQuery({
    queryKey: reportsQueryKeys.invoices(queryParams),
    queryFn: () => reportsApi.invoices(queryParams),
    enabled: qEnabled,
  });

  if (!allowed) return <p className="text-sm text-muted-foreground">No access to this report.</p>;

  const pg = q.data?.meta.pagination;
  const totalPages = pg?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Invoice report" description="Invoices issued in the period with balance breakdown." />
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
        <div className="min-w-[160px] space-y-2">
          <Label>Status</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={invoiceStatus}
            onChange={(e) => {
              setInvoiceStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All'}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[140px] space-y-2">
          <Label>Sort</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="createdAt">Created</option>
            <option value="dueDate">Due</option>
            <option value="dueAmount">Due amt</option>
            <option value="invoiceNumber">Number</option>
          </select>
        </div>
        <div className="min-w-[120px] space-y-2">
          <Label>Order</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
        <ReportExportButtons
          exportPath="/reports/invoices/export"
          fileBaseName="invoices-report"
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
            { key: 'totalAmount', label: 'Total' },
            { key: 'paidAmount', label: 'Paid' },
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
