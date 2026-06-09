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

const METHODS = ['', 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'WALLET', 'OTHER'] as const;

export default function ReportsPaymentsPage() {
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
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [sortBy, setSortBy] = useState('paidAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const queryParams = useMemo(
    () => ({
      ...listParams,
      page,
      limit: 20,
      paymentMethod: paymentMethod || undefined,
      sortBy,
      sortOrder,
    }),
    [listParams, page, paymentMethod, sortBy, sortOrder],
  );

  const qEnabled = allowed && scopedQueryEnabled;

  const q = useQuery({
    queryKey: reportsQueryKeys.payments(queryParams),
    queryFn: () => reportsApi.payments(queryParams),
    enabled: qEnabled,
  });

  if (!allowed) return <p className="text-sm text-muted-foreground">No access to this report.</p>;

  const pg = q.data?.meta.pagination;
  const totalPages = pg?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Payment report" description="Completed payments in range with receipt and invoice context." />
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
          <Label>Method</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPage(1);
            }}
          >
            {METHODS.map((m) => (
              <option key={m || 'all'} value={m}>
                {m || 'All'}
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
            <option value="paidAt">Paid at</option>
            <option value="amount">Amount</option>
            <option value="createdAt">Created</option>
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
          exportPath="/reports/payments/export"
          fileBaseName="payments-report"
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
            { key: 'paidAt', label: 'Paid at' },
            { key: 'receiptNumber', label: 'Receipt' },
            { key: 'invoiceNumber', label: 'Invoice' },
            { key: 'amount', label: 'Amount' },
            { key: 'method', label: 'Method' },
            { key: 'status', label: 'Status' },
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
