'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, RefreshCw, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ROUTES, platformTenantRoute } from '@/constants/routes';
import { ROLES } from '@/constants/permissions';
import { formatCurrency } from '@/lib/utils';
import { ApiError } from '@/lib/api-error';
import type { LibrarySubscriptionSummary } from '@/modules/library/types';
import { billingApi } from '@/modules/billing/billing.service';
import { platformApi } from '@/modules/platform/platform.service';
import { SupportContactActions } from '@/components/support/support-contact-actions';
import { usePlatformSupportConfig } from '@/hooks/use-platform-support-config';
import { AdjustSubscriptionDialog } from '@/modules/subscription/components/adjust-subscription-dialog';
import { invalidateSubscriptionQueries } from '@/modules/subscription/subscription-invalidate';
import { SubscriptionUsagePanel } from '@/modules/subscription/components/subscription-usage-panel';
import type { SubscriptionUsageSnapshot } from '@/modules/subscription/subscription-usage.types';
import { subscriptionQueryKeys } from '@/modules/subscription/subscription-query-keys';

export type BillingSnapshot = Record<string, unknown>;

function fmtDate(v: unknown): string {
  if (v == null || v === '') return '—';
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function subsection(title: string, children: ReactNode) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function kv(label: string, value: ReactNode) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function FlagRow({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
      <span>{label}</span>
      {on ? (
        <Check className="h-4 w-4 text-emerald-600" aria-hidden />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
    </div>
  );
}

export interface SubscriptionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryId: string;
  planCode: string;
  snapshot?: BillingSnapshot | undefined;
  subscription?: LibrarySubscriptionSummary;
  isLoading?: boolean;
  viewerRole: string | undefined;
}

export function SubscriptionDetailDialog({
  open,
  onOpenChange,
  libraryId,
  planCode,
  snapshot: prefetchedSnapshot,
  subscription: prefetchedSubscription,
  isLoading: prefetchedLoading,
  viewerRole,
}: SubscriptionDetailDialogProps) {
  const qc = useQueryClient();
  const { config: platformSupport } = usePlatformSupportConfig();
  const ownerEligible = viewerRole === ROLES.LIBRARY_OWNER;
  const platformEligible = viewerRole === ROLES.SUPER_ADMIN;

  const snapshotQ = useQuery({
    queryKey: ownerEligible
      ? subscriptionQueryKeys.ownerSnapshot(libraryId)
      : subscriptionQueryKeys.librarySnapshot(libraryId),
    queryFn: async () => {
      if (ownerEligible) return billingApi.subscriptionSnapshot();
      return platformApi.subscriptionSnapshot(libraryId);
    },
    enabled: open && (ownerEligible || platformEligible),
    staleTime: 0,
  });

  const timelineQ = useQuery({
    queryKey: subscriptionQueryKeys.libraryTimeline(libraryId),
    queryFn: () => platformApi.librarySubscription(libraryId),
    enabled: open && platformEligible && Boolean(libraryId),
    staleTime: 0,
  });

  const snapshot = (snapshotQ.data ?? prefetchedSnapshot) as BillingSnapshot | undefined;
  const isLoading = Boolean(
    prefetchedLoading ?? (snapshotQ.isLoading && snapshotQ.data == null && prefetchedSnapshot == null),
  );

  const sub = (snapshot?.subscription ?? prefetchedSubscription) as LibrarySubscriptionSummary | undefined;
  const plan = snapshot?.plan as Record<string, unknown> | undefined;
  const dates = snapshot?.dates as Record<string, unknown> | undefined;
  const remaining = snapshot?.remaining as Record<string, unknown> | undefined;
  const usage = snapshot?.usage as Record<string, unknown> | undefined;
  const financial = (snapshot?.financial ?? snapshot?.billing) as Record<string, unknown> | undefined;
  const support = snapshot?.support as Record<string, unknown> | undefined;
  const features = (snapshot?.featureFlags ?? snapshot?.features) as Record<string, boolean> | undefined;
  const library = snapshot?.library as Record<string, unknown> | undefined;
  const record = snapshot?.subscriptionRecord as Record<string, unknown> | undefined;
  const upcoming = record?.upcoming as Record<string, unknown> | null | undefined;
  const currentInvoice = (financial?.currentInvoice ?? sub?.currentInvoice) as
    | LibrarySubscriptionSummary['currentInvoice']
    | undefined;

  const uiStatus = String(sub?.expiryState ?? snapshot?.expiryState ?? snapshot?.uiStatus ?? '');
  const isTrial = Boolean(snapshot?.isTrial ?? uiStatus === 'TRIAL');
  const planName = String(plan?.displayName ?? sub?.planName ?? '—');
  const planCodeLabel = String(plan?.code ?? sub?.planCode ?? planCode);
  const showPlanCode =
    planCodeLabel &&
    planName &&
    planCodeLabel.toUpperCase() !== planName.toUpperCase().replace(/\s+/g, '_');

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [extendReason, setExtendReason] = useState('');

  const applySnapshot = (next?: Record<string, unknown>) => {
    if (!next) return;
    const key = ownerEligible
      ? subscriptionQueryKeys.ownerSnapshot(libraryId)
      : subscriptionQueryKeys.librarySnapshot(libraryId);
    qc.setQueryData(key, next);
  };

  const refresh = async (next?: Record<string, unknown>) => {
    applySnapshot(next);
    await invalidateSubscriptionQueries(qc, libraryId);
    void snapshotQ.refetch();
    if (platformEligible) void timelineQ.refetch();
  };

  const syncM = useMutation({
    mutationFn: () => platformApi.syncLibrarySubscription(libraryId),
    onSuccess: async (data) => {
      toast.success('Subscription synced');
      await refresh((data as { snapshot?: Record<string, unknown> }).snapshot);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Sync failed'),
  });

  const extendM = useMutation({
    mutationFn: () =>
      platformApi.extendLibraryTrial(libraryId, {
        trialEndsAt: new Date(extendDate).toISOString(),
        reason: extendReason.trim(),
      }),
    onSuccess: async (data) => {
      toast.success('Trial extended');
      setExtendOpen(false);
      await refresh((data as { snapshot?: Record<string, unknown> }).snapshot);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Extend failed'),
  });

  const timeline = (timelineQ.data?.timeline ?? []) as Array<{
    title: string;
    type: string;
    createdAt: string;
    description?: string | null;
  }>;

  const syncedAt = snapshot?.syncedAt ? fmtDate(snapshot.syncedAt) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(80vh,100dvh)] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="text-lg">Subscription</DialogTitle>
              <DialogDescription>
                Plan <span className="font-semibold text-foreground">{planName}</span>
                {showPlanCode ? (
                  <span className="text-muted-foreground"> ({planCodeLabel})</span>
                ) : null}
                {library?.name ? (
                  <>
                    {' '}
                    · <span className="text-foreground">{String(library.name)}</span>
                  </>
                ) : null}
              </DialogDescription>
              {syncedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">Last synced {syncedAt}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={snapshotQ.isFetching}
              onClick={() => void refresh()}
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${snapshotQ.isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(min(80vh,100dvh)-11rem)] w-full">
          <div className="px-6 py-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading subscription details…</p>
            ) : snapshotQ.isError && !prefetchedSnapshot ? (
              <p className="text-sm text-destructive">Could not load subscription snapshot.</p>
            ) : (
              <div className="space-y-6">
                {record?.manuallyAdjusted ? (
                  <Badge variant="outline" className="border-amber-500 text-amber-700">
                    Manual adjustment
                  </Badge>
                ) : null}

                {isTrial ? (
                  <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-200">Free trial active</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Trial ends {fmtDate(sub?.trialEndsAt ?? dates?.trialEndsAt)}
                      {sub?.daysRemaining != null ? ` · ${sub.daysRemaining} day(s) left` : ''}
                    </p>
                  </div>
                ) : null}

                {subsection(
                  'Current subscription',
                  <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4">
                    {kv('Plan name', planName)}
                    {kv('Billing cycle', String(sub?.billingCycle ?? plan?.billingCycle ?? '—'))}
                    {kv('Status', String(sub?.status ?? library?.subscriptionStatus ?? '—'))}
                    {kv('Lifecycle', uiStatus || '—')}
                    {kv(
                      'Start date',
                      fmtDate(
                        (snapshot as Record<string, unknown> | undefined)?.startDate ??
                          sub?.startDate ??
                          dates?.subscriptionStartsAt,
                      ),
                    )}
                    {kv(
                      'End / renewal',
                      fmtDate(
                        (snapshot as Record<string, unknown> | undefined)?.endDate ??
                          sub?.endDate ??
                          dates?.subscriptionEndsAt ??
                          dates?.renewalDate,
                      ),
                    )}
                    {isTrial ? kv('Trial ends', fmtDate(sub?.trialEndsAt ?? dates?.trialEndsAt)) : null}
                    {kv(
                      'Days remaining',
                      sub?.daysRemaining != null
                        ? String(sub.daysRemaining)
                        : remaining?.trialDaysRemaining != null
                          ? `${String(remaining.trialDaysRemaining)} (trial)`
                          : remaining?.subscriptionDaysRemaining != null
                            ? String(remaining.subscriptionDaysRemaining)
                            : '—',
                    )}
                    {(sub?.graceDaysRemaining ?? remaining?.subscriptionGraceDaysRemaining) != null
                      ? kv(
                          'Grace days remaining',
                          String(sub?.graceDaysRemaining ?? remaining?.subscriptionGraceDaysRemaining),
                        )
                      : null}
                  </div>,
                )}

                {upcoming
                  ? subsection(
                      'Upcoming plan',
                      <div className="space-y-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
                        <Badge variant="outline" className="border-blue-500/50 text-blue-700">
                          UPCOMING
                        </Badge>
                        {kv('Plan', String(upcoming.planName ?? upcoming.planCode ?? '—'))}
                        {kv('Billing cycle', String(upcoming.billingCycle ?? '—'))}
                        {kv('Starts', fmtDate(upcoming.startDate))}
                        {kv('Ends', fmtDate(upcoming.endDate))}
                        <p className="text-xs text-muted-foreground">
                          Paid invoice recorded; access switches on the start date above.
                        </p>
                      </div>,
                    )
                  : null}

                {subsection(
                  'Plan usage',
                  usage && (usage as SubscriptionUsageSnapshot).seats ? (
                    <div className="rounded-xl border border-border/60 p-4">
                      <SubscriptionUsagePanel
                        usage={usage as SubscriptionUsageSnapshot}
                        usageStatus={String(snapshot?.usageStatus ?? '')}
                        detailed
                      />
                      <p className="mt-3 text-xs text-muted-foreground">
                        Storage: {Number(usage?.storageUsedMb ?? 0)} /{' '}
                        {(usage as SubscriptionUsageSnapshot).storage?.unlimited
                          ? 'Unlimited'
                          : String(usage?.storageLimitMb ?? '—')}{' '}
                        MB
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Usage data unavailable.</p>
                  ),
                )}

                {subsection(
                  'Financial',
                  <div className="space-y-2 rounded-xl border border-border/60 p-4">
                    {currentInvoice ? (
                      <>
                        {kv('Invoice #', currentInvoice.invoiceNumber)}
                        {kv('Invoice amount', formatCurrency(currentInvoice.amount))}
                        {kv(
                          'Paid / due',
                          `${formatCurrency(currentInvoice.paidAmount)} / ${formatCurrency(currentInvoice.dueAmount)}`,
                        )}
                        {kv('Invoice due', fmtDate(currentInvoice.dueDate))}
                        {kv('Invoice status', currentInvoice.status)}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">No open subscription invoice.</p>
                    )}
                    {kv(
                      'Total due',
                      financial?.dueAmountTotal != null
                        ? formatCurrency(Number(financial.dueAmountTotal))
                        : sub?.dueAmount != null
                          ? formatCurrency(sub.dueAmount)
                          : '—',
                    )}
                    {kv('Last payment', fmtDate(sub?.lastPaymentAt ?? financial?.lastPaymentAt))}
                  </div>,
                )}

                {platformEligible && timeline.length > 0
                  ? subsection(
                      'Timeline',
                      <ul className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-border/60 p-3 text-sm">
                        {timeline.slice(0, 20).map((ev, i) => (
                          <li key={`${ev.type}-${i}`} className="border-b border-border/40 pb-2 last:border-0">
                            <p className="font-medium">{ev.title}</p>
                            {ev.description ? (
                              <p className="text-xs text-muted-foreground">{ev.description}</p>
                            ) : null}
                            <p className="text-xs text-muted-foreground">
                              {fmtDate(ev.createdAt)} · {ev.type}
                            </p>
                          </li>
                        ))}
                      </ul>,
                    )
                  : null}

                {subsection(
                  'Plan features',
                  (() => {
                    const access = snapshot?.featureAccess as
                      | {
                          included?: Array<{ key: string; label: string }>;
                          unavailable?: Array<{ key: string; label: string }>;
                        }
                      | undefined;
                    const included = access?.included ?? [];
                    const unavailable = access?.unavailable ?? [];
                    return (
                      <div className="space-y-3 rounded-xl border border-border/60 p-4 text-sm">
                        {included.length > 0 ? (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Included</p>
                            <ul className="space-y-1">
                              {included.map((f) => (
                                <li key={f.key} className="flex items-center gap-2">
                                  <Check className="h-4 w-4 text-emerald-600" aria-hidden />
                                  {f.label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {unavailable.length > 0 ? (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                              Not on plan — upgrade to unlock
                            </p>
                            <ul className="space-y-1 text-muted-foreground">
                              {unavailable.slice(0, 12).map((f) => (
                                <li key={f.key} className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 shrink-0 text-red-500/80" aria-hidden />
                                  {f.label}
                                </li>
                              ))}
                              {unavailable.length > 12 ? (
                                <li className="text-xs">+{unavailable.length - 12} more</li>
                              ) : null}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    );
                  })(),
                )}

                {subsection(
                  'Support',
                  <div className="rounded-xl border border-border/60 p-4">
                    <SupportContactActions config={platformSupport} compact />
                  </div>,
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="shrink-0 border-t bg-background px-6 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>
          <div className="flex flex-wrap gap-2">
            {platformEligible ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={platformTenantRoute(libraryId)}>Tenant admin</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`${ROUTES.PLATFORM_SUBSCRIPTION_INVOICES}?libraryId=${encodeURIComponent(libraryId)}`}>
                    View invoices
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`${ROUTES.PLATFORM_SUBSCRIPTION_INVOICES}?libraryId=${encodeURIComponent(libraryId)}&create=1`}>
                    Create invoice
                  </Link>
                </Button>
                <Button variant="secondary" size="sm" type="button" onClick={() => setAdjustOpen(true)}>
                  Adjust subscription
                </Button>
                <Button variant="outline" size="sm" type="button" onClick={() => setExtendOpen(true)}>
                  Extend trial
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={syncM.isPending}
                  onClick={() => syncM.mutate()}
                >
                  Sync
                </Button>
              </>
            ) : ownerEligible ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={ROUTES.BILLING}>Billing</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={ROUTES.BILLING}>Contact support</Link>
                </Button>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Actions available to subscription admins only.</p>
            )}
          </div>
        </div>
      </DialogContent>

      <AdjustSubscriptionDialog open={adjustOpen} onOpenChange={setAdjustOpen} libraryId={libraryId} />

      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extend trial</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <label className="grid gap-2 text-sm">
              New trial end date
              <input
                type="date"
                className="h-10 rounded-md border border-input px-2"
                value={extendDate}
                onChange={(e) => setExtendDate(e.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Reason (required)
              <textarea
                className="min-h-[72px] rounded-md border border-input px-2 py-2 text-sm"
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setExtendOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={extendM.isPending || !extendDate || extendReason.trim().length < 3}
              onClick={() => extendM.mutate()}
            >
              Extend
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
