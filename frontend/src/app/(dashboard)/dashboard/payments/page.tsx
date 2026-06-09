'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { formatEntityLabel } from '@/lib/entity-label';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import {
  PAYMENTS_COLLECT,
  PAYMENTS_DUES,
  PAYMENTS_FEE_PLANS,
  PAYMENTS_FEE_PLANS_NEW,
  PAYMENTS_INVOICES,
  PAYMENTS_INVOICES_NEW,
  PAYMENTS_OVERDUE,
} from '@/constants/routes';
import { useAuthStore } from '@/store/auth.store';
import { usePermissions } from '@/hooks/use-permissions';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';

function startEndOfMonth(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { from, to };
}

export default function PaymentsDashboardPage() {
  const { can } = usePermissions();
  const libraryId = useAuthStore((s) => s.user?.libraryId ?? undefined);
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const { from, to } = useMemo(() => startEndOfMonth(), []);

  const summaryParams = useMemo(
    () => ({
      from: from.toISOString(),
      to: to.toISOString(),
      granularity: 'day' as const,
      libraryId,
      branchId: branchId ?? undefined,
    }),
    [from, to, libraryId, branchId],
  );

  const canSummary = can(PERMISSIONS.PAYMENT_SUMMARY);
  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: paymentQueryKeys.summary(summaryParams),
    queryFn: () => paymentApi.summary(summaryParams),
    enabled: canSummary,
  });

  const { data: dues, isLoading: duesLoading } = useQuery({
    queryKey: paymentQueryKeys.dues({ page: 1, limit: 1, libraryId, branchId }),
    queryFn: () => paymentApi.listDues({ page: 1, limit: 1, libraryId, branchId }),
    enabled: can(PERMISSIONS.PAYMENT_READ),
  });

  const { data: overdue, isLoading: odLoading } = useQuery({
    queryKey: paymentQueryKeys.overdue({ page: 1, limit: 1, libraryId, branchId }),
    queryFn: () => paymentApi.listOverdue({ page: 1, limit: 1, libraryId, branchId }),
    enabled: can(PERMISSIONS.PAYMENT_READ),
  });

  const monthTotal = summary?.byBranch?.reduce((s, b) => s + b.totalCollected, 0) ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payments"
        description="Invoices, collections, fee plans, and receipts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={PAYMENTS_INVOICES}>Invoices</Link>
            </Button>
            {can(PERMISSIONS.PAYMENT_CREATE) ? (
              <Button asChild>
                <Link href={PAYMENTS_COLLECT}>Collect payment</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This month (collections)</CardTitle>
          </CardHeader>
          <CardContent>
            {canSummary && sumLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-semibold">₹{monthTotal.toFixed(2)}</p>
            )}
            {!canSummary ? <p className="text-xs text-muted-foreground">Requires payment.summary</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open dues</CardTitle>
          </CardHeader>
          <CardContent>
            {duesLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-semibold">{dues?.pagination.total ?? 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overdue invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {odLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-semibold">{overdue?.pagination.total ?? 0}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Branches (MTD)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {summary?.byBranch?.length
              ? summary.byBranch.map((b) => (
                  <p key={String(b.branchId ?? b._id)}>
                    {formatEntityLabel(b, 'branch')}: ₹{b.totalCollected.toFixed(2)}
                  </p>
                ))
              : '—'}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {can(PERMISSIONS.FEE_PLAN_READ) ? (
          <Button variant="outline" asChild className="h-auto justify-start py-4">
            <Link href={PAYMENTS_FEE_PLANS}>Fee plans</Link>
          </Button>
        ) : null}
        {can(PERMISSIONS.FEE_PLAN_CREATE) ? (
          <Button variant="outline" asChild className="h-auto justify-start py-4">
            <Link href={PAYMENTS_FEE_PLANS_NEW}>New fee plan</Link>
          </Button>
        ) : null}
        {can(PERMISSIONS.PAYMENT_READ) ? (
          <Button variant="outline" asChild className="h-auto justify-start py-4">
            <Link href={PAYMENTS_INVOICES}>All invoices</Link>
          </Button>
        ) : null}
        {can(PERMISSIONS.PAYMENT_CREATE) ? (
          <Button variant="outline" asChild className="h-auto justify-start py-4">
            <Link href={PAYMENTS_INVOICES_NEW}>New invoice</Link>
          </Button>
        ) : null}
        {can(PERMISSIONS.PAYMENT_READ) ? (
          <Button variant="outline" asChild className="h-auto justify-start py-4">
            <Link href={PAYMENTS_DUES}>Dues</Link>
          </Button>
        ) : null}
        {can(PERMISSIONS.PAYMENT_READ) ? (
          <Button variant="outline" asChild className="h-auto justify-start py-4">
            <Link href={PAYMENTS_OVERDUE}>Overdue</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
