'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { PlatformPlanSelect } from '@/modules/platform/components/platform-plan-select';
import { PlatformTenantSelect } from '@/modules/platform/components/platform-tenant-select';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import { invalidateSubscriptionQueries } from '@/modules/subscription/subscription-invalidate';
import { CreateSubscriptionInvoiceDialog } from '@/modules/subscription/components/create-subscription-invoice-dialog';
import { PAYMENT_METHODS } from '@/modules/subscription/subscription-invoice-form.utils';

type InvoiceRow = Record<string, unknown> & {
  id: string;
  invoiceNumber: string;
  libraryName?: string;
  planName: string;
  billingCycle: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  issueDate: string;
  dueDate: string;
  subscriptionStartDate: string;
  subscriptionEndDate: string;
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function PlatformSubscriptionInvoicesPage() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const presetLibraryId = searchParams.get('libraryId') ?? '';

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [libraryIdFilter, setLibraryIdFilter] = useState(presetLibraryId);
  const [planIdFilter, setPlanIdFilter] = useState('');
  const [billingCycleFilter, setBillingCycleFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [collectOpen, setCollectOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [collectAmount, setCollectAmount] = useState('');
  const [collectMethod, setCollectMethod] = useState('CASH');
  const [collectTxn, setCollectTxn] = useState('');

  const listParams = useMemo(
    () => ({
      page: '1',
      limit: '30',
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status ? { status } : {}),
      ...(libraryIdFilter ? { libraryId: libraryIdFilter } : {}),
      ...(planIdFilter ? { planId: planIdFilter } : {}),
      ...(billingCycleFilter ? { billingCycle: billingCycleFilter } : {}),
      ...(overdueOnly ? { overdueOnly: 'true' } : {}),
    }),
    [search, status, libraryIdFilter, planIdFilter, billingCycleFilter, overdueOnly],
  );

  const q = useQuery({
    queryKey: platformQueryKeys.subscriptionInvoices(listParams),
    queryFn: () => platformApi.subscriptionInvoices(listParams),
    enabled: can(PERMISSIONS.PLATFORM_MANAGE),
  });

  const items = ((q.data?.data.items ?? []) as InvoiceRow[]) ?? [];

  const detailQ = useQuery({
    queryKey: [...platformQueryKeys.all, 'subscription-invoice', selectedId],
    queryFn: () => platformApi.subscriptionInvoice(selectedId!),
    enabled: Boolean(selectedId) && detailOpen && can(PERMISSIONS.PLATFORM_MANAGE),
  });

  const detail = detailQ.data as InvoiceRow | undefined;

  const collectM = useMutation({
    mutationFn: () =>
      platformApi.collectSubscriptionInvoice(selectedId!, {
        amount: Number(collectAmount),
        paymentMethod: collectMethod,
        ...(collectTxn.trim() ? { transactionId: collectTxn.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success('Payment recorded');
      setCollectOpen(false);
      invalidateSubscriptionQueries(qc, libraryIdFilter || undefined);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Collect failed'),
  });

  const cancelM = useMutation({
    mutationFn: (invoiceId: string) => platformApi.cancelSubscriptionInvoice(invoiceId, {}),
    onSuccess: () => {
      toast.success('Invoice cancelled');
      invalidateSubscriptionQueries(qc);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Cancel failed'),
  });

  if (!can(PERMISSIONS.PLATFORM_MANAGE)) {
    return <p className="text-sm text-muted-foreground">Platform access required.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.PLATFORM}>← Platform</Link>
        </Button>
      </div>
      <PageHeader
        title="Subscription invoices"
        description="Issue SaaS invoices to libraries, collect payments, and monitor status."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            Create invoice
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Search invoice #, plan, library…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <div className="w-56">
          <PlatformTenantSelect
            label="Library"
            value={libraryIdFilter}
            onChange={(id) => setLibraryIdFilter(id)}
          />
        </div>
        <div className="w-48">
          <PlatformPlanSelect
            label="Plan"
            value={planIdFilter}
            onChange={(id) => setPlanIdFilter(id)}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
          value={billingCycleFilter}
          onChange={(e) => setBillingCycleFilter(e.target.value)}
        >
          <option value="">All cycles</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
          <option value="CUSTOM">Custom</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          Overdue only
        </label>
        {(libraryIdFilter || planIdFilter || status || overdueOnly) && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={() => {
              setLibraryIdFilter('');
              setPlanIdFilter('');
              setStatus('');
              setOverdueOnly(false);
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load invoices.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Library</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Sub. start</TableHead>
                <TableHead>Sub. end</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="text-center text-muted-foreground">
                    No invoices found.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell className="font-medium">{String(row.invoiceNumber)}</TableCell>
                    <TableCell>{String(row.libraryName ?? '—')}</TableCell>
                    <TableCell>{String(row.planName)}</TableCell>
                    <TableCell className="text-xs">{String(row.billingCycle)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(row.amount ?? 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(row.paidAmount ?? 0))}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(row.dueAmount ?? 0))}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{String(row.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(row.issueDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(row.dueDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(row.subscriptionStartDate)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtDate(row.subscriptionEndDate)}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setSelectedId(String(row.id));
                          setDetailOpen(true);
                        }}
                      >
                        Details
                      </Button>
                      {row.status !== 'PAID' && row.status !== 'CANCELLED' ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={() => {
                              setSelectedId(String(row.id));
                              setCollectAmount(String(row.dueAmount ?? ''));
                              setCollectOpen(true);
                            }}
                          >
                            Collect
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="text-destructive"
                            onClick={() => {
                              if (!window.confirm('Cancel this invoice?')) return;
                              cancelM.mutate(String(row.id));
                            }}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateSubscriptionInvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        presetLibraryId={presetLibraryId}
      />

      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect payment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="camt">Amount</Label>
              <Input id="camt" inputMode="decimal" value={collectAmount} onChange={(e) => setCollectAmount(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Payment method</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={collectMethod}
                onChange={(e) => setCollectMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ctx">Transaction ID</Label>
              <Input id="ctx" value={collectTxn} onChange={(e) => setCollectTxn(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setCollectOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              disabled={collectM.isPending || !selectedId || !collectAmount.trim()}
              onClick={() => collectM.mutate()}
            >
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invoice detail</DialogTitle>
          </DialogHeader>
          {detailQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : detail ? (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Invoice</dt>
                <dd className="font-medium">{detail.invoiceNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Library</dt>
                <dd>{String(detail.libraryName ?? '—')}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Plan</dt>
                <dd>{detail.planName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant="outline">{detail.status}</Badge>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Amount / paid / due</dt>
                <dd>
                  {formatCurrency(detail.amount)} / {formatCurrency(detail.paidAmount)} /{' '}
                  {formatCurrency(detail.dueAmount)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Issue / due</dt>
                <dd>
                  {fmtDate(detail.issueDate)} · {fmtDate(detail.dueDate)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Subscription period</dt>
                <dd>
                  {fmtDate(detail.subscriptionStartDate)} – {fmtDate(detail.subscriptionEndDate)}
                </dd>
              </div>
            </dl>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
