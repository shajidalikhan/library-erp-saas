'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ROLES } from '@/constants/permissions';
import { cn, formatCurrency } from '@/lib/utils';
import { SupportContactActions } from '@/components/support/support-contact-actions';
import { usePlatformSupportConfig } from '@/hooks/use-platform-support-config';
import { OwnerInvoiceDetailDialog } from '@/modules/billing/components/owner-invoice-detail-dialog';
import { billingApi } from '@/modules/billing/billing.service';
import { subscriptionQueryKeys } from '@/modules/subscription/subscription-query-keys';
import { SubscriptionPlanBadge } from '@/modules/subscription/components/subscription-plan-badge';
import { selectUser, useAuthStore } from '@/store/auth.store';

export default function BillingPage() {
  const user = useAuthStore(selectUser);
  const [invoiceDetailId, setInvoiceDetailId] = useState<string | null>(null);
  const { config: supportConfig } = usePlatformSupportConfig();

  const subQ = useQuery({
    queryKey: subscriptionQueryKeys.ownerSnapshot(user!.libraryId!),
    queryFn: () => billingApi.subscriptionSnapshot(),
    enabled: user?.role === ROLES.LIBRARY_OWNER && Boolean(user.libraryId),
    staleTime: 0,
  });

  const invQ = useQuery({
    queryKey: ['billing', 'subscription-invoices'],
    queryFn: () => billingApi.invoices({ page: '1', limit: '50' }),
    enabled: user?.role === ROLES.LIBRARY_OWNER && Boolean(user.libraryId),
  });

  if (user?.role !== ROLES.LIBRARY_OWNER || !user.libraryId) {
    return (
      <EmptyState title="Billing unavailable" description="Only library owners can access SaaS subscription billing." />
    );
  }

  const snap = subQ.data as Record<string, unknown> | undefined;
  const subscription = snap?.subscription as import('@/modules/library/types').LibrarySubscriptionSummary | undefined;
  const uiStatus = String(subscription?.expiryState ?? snap?.expiryState ?? snap?.uiStatus ?? '');
  const libSnap = snap?.library as Record<string, unknown> | undefined;
  const dates = snap?.dates as Record<string, unknown> | undefined;
  const billing = (snap?.financial ?? snap?.billing) as Record<string, unknown> | undefined;
  const isTrial = Boolean(snap?.isTrial ?? uiStatus === 'TRIAL');
  const planMeta = snap?.plan as { code?: string; displayName?: string } | undefined;
  const planCodeLabel = String(planMeta?.code ?? subscription?.planCode ?? '');

  const warnings: { key: string; title: string; body: string; variant?: 'default' | 'destructive' }[] = [];
  if (subscription?.warningMessage) {
    warnings.push({
      key: 'lifecycle',
      title: 'Subscription notice',
      body: subscription.warningMessage,
      variant:
        uiStatus === 'SUSPENDED' || uiStatus === 'EXPIRED' || uiStatus === 'GRACE_PERIOD'
          ? 'destructive'
          : 'default',
    });
  }
  if (libSnap?.status === 'SUSPENDED') {
    warnings.push({
      key: 'suspended',
      title: 'Library suspended',
      body: 'Your workspace is suspended. Clear subscription dues or contact support.',
      variant: 'destructive',
    });
  }
  if (uiStatus === 'SUSPENDED' || uiStatus === 'OVERDUE') {
    warnings.push({
      key: 'overdue',
      title: 'Subscription payment overdue',
      body: 'Please pay outstanding SaaS invoices to avoid interruption.',
      variant: 'destructive',
    });
  }

  const rows = ((invQ.data?.data.items ?? []) as Record<string, unknown>[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Your Library ERP SaaS subscription, invoices, and platform contacts."
      />

      {isTrial && subscription?.trialEndsAt ? (
        <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-4 text-sm">
          <p className="font-semibold text-blue-900 dark:text-blue-200">Free trial</p>
          <p className="mt-1 text-muted-foreground">
            Trial ends {new Date(String(subscription.trialEndsAt)).toLocaleDateString()}
            {subscription.daysRemaining != null
              ? ` · ${subscription.daysRemaining} day${subscription.daysRemaining === 1 ? '' : 's'} remaining`
              : ''}
          </p>
        </div>
      ) : null}

      {warnings.map((w) => (
        <div
          key={w.key}
          className={cn(
            'flex gap-3 rounded-lg border p-4 text-sm',
            w.variant === 'destructive'
              ? 'border-destructive/35 bg-destructive/10 text-destructive'
              : 'border-border bg-muted/30',
          )}
        >
          {w.variant === 'destructive' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : null}
          <div>
            <p className="font-semibold">{w.title}</p>
            <p className={cn('mt-1', w.variant !== 'destructive' && 'text-muted-foreground')}>{w.body}</p>
          </div>
        </div>
      ))}

      {subQ.isLoading ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : subQ.isError ? (
        <p className="text-sm text-destructive">Could not load subscription summary.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-border/60 shadow-soft lg:col-span-2">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Plan</CardTitle>
                <p className="text-sm text-muted-foreground">Current SaaS entitlement</p>
              </div>
              <SubscriptionPlanBadge
                libraryId={user.libraryId}
                planCode={planCodeLabel}
                prefetchedSnapshot={snap}
                prefetchedSubscription={subscription}
              />
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">Status</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="secondary">{String(libSnap?.status ?? '—')}</Badge>
                  <Badge variant="outline">{uiStatus || '—'}</Badge>
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">Start / end</p>
                <p className="mt-1 text-sm">
                  {subscription?.startDate
                    ? new Date(subscription.startDate).toLocaleDateString()
                    : '—'}{' '}
                  →{' '}
                  {isTrial && subscription?.trialEndsAt
                    ? new Date(subscription.trialEndsAt).toLocaleDateString()
                    : subscription?.endDate
                      ? new Date(subscription.endDate).toLocaleDateString()
                      : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {subscription?.daysRemaining != null
                    ? `${subscription.daysRemaining} day(s) remaining`
                    : ''}
                  {subscription?.billingCycle ? ` · ${subscription.billingCycle}` : ''}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:col-span-2">
                <p className="text-xs uppercase text-muted-foreground">Amount due (open invoices)</p>
                <p className="mt-1 text-2xl font-semibold">
                  {billing?.dueAmountTotal != null ? formatCurrency(Number(billing.dueAmountTotal)) : '—'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-soft">
            <CardHeader>
              <CardTitle className="text-base">Support</CardTitle>
            </CardHeader>
            <CardContent>
              <SupportContactActions config={supportConfig} />
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Subscription invoices</CardTitle>
          <Button variant="outline" size="sm" disabled title="PDF downloads coming soon">
            Download latest
          </Button>
        </CardHeader>
        <CardContent>
          {invQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : invQ.isError ? (
            <p className="text-sm text-destructive">Could not load invoices.</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscription invoices yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Due amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={String(r.id)}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setInvoiceDetailId(String(r.id))}
                    >
                      <TableCell className="font-medium">{String(r.invoiceNumber)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{String(r.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.dueDate ? new Date(String(r.dueDate)).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(r.dueAmount ?? 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={ROUTES.NOTIFICATIONS}>Notifications</Link>
        </Button>
      </div>

      <OwnerInvoiceDetailDialog
        invoiceId={invoiceDetailId}
        open={Boolean(invoiceDetailId)}
        onOpenChange={(open) => {
          if (!open) setInvoiceDetailId(null);
        }}
      />
    </div>
  );
}
