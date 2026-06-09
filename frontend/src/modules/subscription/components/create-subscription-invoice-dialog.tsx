'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-error';
import { formatCurrency } from '@/lib/utils';
import { PlatformPlanSelect } from '@/modules/platform/components/platform-plan-select';
import { PlatformTenantSelect } from '@/modules/platform/components/platform-tenant-select';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import { invalidateSubscriptionQueries } from '@/modules/subscription/subscription-invalidate';
import { subscriptionQueryKeys } from '@/modules/subscription/subscription-query-keys';
import {
  PAYMENT_METHODS,
  addDaysInputDate,
  computeRenewalStartFromLibrary,
  computeSubscriptionDates,
  deriveInvoicePreviewStatus,
  planAmountForCycle,
  toInputDate,
  todayInputDate,
  type BillingCycle,
  type PlatformPlanOption,
} from '@/modules/subscription/subscription-invoice-form.utils';
import {
  FEATURE_FLAG_OPTIONS,
  SUBSCRIPTION_PLAN_FEATURE_FLAG_KEYS,
} from '@/modules/platform/subscription-plan-feature-flags.constants';

function fmtDateInput(v: unknown): string {
  if (!v) return '—';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export interface CreateSubscriptionInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetLibraryId?: string;
}

export function CreateSubscriptionInvoiceDialog({
  open,
  onOpenChange,
  presetLibraryId = '',
}: CreateSubscriptionInvoiceDialogProps) {
  const qc = useQueryClient();

  const [libraryId, setLibraryId] = useState(presetLibraryId);
  const [planId, setPlanId] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlatformPlanOption | undefined>();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [amountOverride, setAmountOverride] = useState(false);
  const [allowOverpayment, setAllowOverpayment] = useState(false);
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(todayInputDate);
  const [dueDate, setDueDate] = useState(() => addDaysInputDate(todayInputDate(), 7));
  const [subStart, setSubStart] = useState(todayInputDate());
  const [subEnd, setSubEnd] = useState('');
  const [startPaidNow, setStartPaidNow] = useState(false);
  const [startAfterTrial, setStartAfterTrial] = useState(true);
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && presetLibraryId) setLibraryId(presetLibraryId);
  }, [open, presetLibraryId]);

  const snapshotQ = useQuery({
    queryKey: subscriptionQueryKeys.librarySnapshot(libraryId),
    queryFn: () => platformApi.subscriptionSnapshot(libraryId),
    enabled: open && Boolean(libraryId),
    staleTime: 0,
  });

  const snap = snapshotQ.data as Record<string, unknown> | undefined;
  const library = snap?.library as Record<string, unknown> | undefined;
  const billing = snap;
  const snapSub = snap?.subscription as Record<string, unknown> | undefined;
  const planMeta = snap?.plan as { displayName?: string; code?: string } | undefined;
  const isTrial = Boolean(snap?.isTrial ?? library?.status === 'TRIAL');

  const syncDatesFromCycle = useMemo(() => {
    if (!libraryId) return null;
    const datesSnap = snap?.dates as Record<string, unknown> | undefined;
    const libDates = {
      status: String(library?.status ?? ''),
      subscriptionEndsAt: datesSnap?.subscriptionEndsAt
        ? new Date(String(datesSnap.subscriptionEndsAt)).toISOString().slice(0, 10)
        : library?.subscriptionEndsAt
          ? new Date(String(library.subscriptionEndsAt)).toISOString().slice(0, 10)
          : null,
      trialEndsAt: datesSnap?.trialEndsAt
        ? new Date(String(datesSnap.trialEndsAt)).toISOString().slice(0, 10)
        : library?.trialEndsAt
          ? new Date(String(library.trialEndsAt)).toISOString().slice(0, 10)
          : null,
      startPaidNow,
      startAfterTrial,
    };
    const start =
      billingCycle === 'CUSTOM'
        ? subStart
        : computeRenewalStartFromLibrary(libDates);
    const { start: s, end: e } = computeSubscriptionDates({
      billingCycle,
      subscriptionStartDate: start,
      customEndDate: billingCycle === 'CUSTOM' ? subEnd : undefined,
    });
    return { start: s, end: e };
  }, [
    libraryId,
    library?.status,
    library?.subscriptionEndsAt,
    library?.trialEndsAt,
    billingCycle,
    subStart,
    subEnd,
    startPaidNow,
    startAfterTrial,
  ]);

  useEffect(() => {
    if (!selectedPlan || billingCycle === 'CUSTOM') return;
    const auto = planAmountForCycle(selectedPlan, billingCycle);
    if (!amountOverride) setAmount(String(auto));
  }, [selectedPlan, billingCycle, amountOverride]);

  useEffect(() => {
    if (!syncDatesFromCycle || billingCycle === 'CUSTOM') return;
    setSubStart(syncDatesFromCycle.start);
    setSubEnd(syncDatesFromCycle.end);
  }, [syncDatesFromCycle, billingCycle]);

  useEffect(() => {
    setDueDate(addDaysInputDate(issueDate, 7));
  }, [issueDate]);

  useEffect(() => {
    const renewalEnd = library?.subscriptionEndsAt
      ? new Date(String(library.subscriptionEndsAt))
      : null;
    if (!renewalEnd || Number.isNaN(renewalEnd.getTime())) return;
    const suggested = addDaysInputDate(issueDate, 7);
    const suggestedMs = new Date(suggested).getTime();
    if (suggestedMs > renewalEnd.getTime()) {
      const before = new Date(renewalEnd);
      before.setDate(before.getDate() - 1);
      if (before.getTime() >= new Date(issueDate).getTime()) {
        setDueDate(toInputDate(before));
      }
    }
  }, [issueDate, library?.subscriptionEndsAt]);

  const amountNum = Number(amount) || 0;
  const paidNum = Number(paidAmount) || 0;
  const dueNum = Math.max(0, Math.round((amountNum - paidNum) * 100) / 100);
  const previewStatus = deriveInvoicePreviewStatus(amountNum, paidNum, dueDate);

  const createM = useMutation({
    mutationFn: () =>
      platformApi.createSubscriptionInvoice({
        libraryId,
        planId,
        billingCycle,
        issueDate: new Date(issueDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        subscriptionStartDate: new Date(subStart).toISOString(),
        subscriptionEndDate: new Date(subEnd).toISOString(),
        amount: amountNum,
        amountOverride: amountOverride || billingCycle === 'CUSTOM',
        allowOverpayment,
        paidAmount: paidNum,
        ...(paidNum > 0 ? { paymentMethod } : {}),
        ...(transactionId.trim() ? { transactionId: transactionId.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(isTrial
          ? {
              startPaidNow,
              startPaidAfterTrial: !startPaidNow && startAfterTrial,
            }
          : {}),
      }),
    onSuccess: () => {
      toast.success('Subscription invoice created');
      onOpenChange(false);
      invalidateSubscriptionQueries(qc, libraryId);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not create invoice'),
  });

  const enabledFlags = selectedPlan?.featureFlags
    ? FEATURE_FLAG_OPTIONS.filter(
        (o) =>
          SUBSCRIPTION_PLAN_FEATURE_FLAG_KEYS.includes(
            o.key as (typeof SUBSCRIPTION_PLAN_FEATURE_FLAG_KEYS)[number],
          ) && selectedPlan.featureFlags?.[o.key],
      )
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,100dvh)] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>Create subscription invoice</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[calc(min(90vh,100dvh)-10.5rem)] w-full">
          <div className="space-y-5 px-6 py-4">
          <PlatformTenantSelect
            value={libraryId}
            onChange={(id) => {
              setLibraryId(id);
              setPlanId('');
              setSelectedPlan(undefined);
            }}
          />

          {libraryId ? (
            snapshotQ.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : (
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Selected library
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium">{String(library?.name ?? '—')}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Owner</span>
                    <p className="font-medium">
                      {String(library?.ownerName ?? '—')}
                      {library?.ownerEmail ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {String(library.ownerEmail)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Current plan</span>
                    <p className="font-medium">
                      {String(
                        planMeta?.displayName ?? snapSub?.planName ?? library?.subscriptionPlan ?? '—',
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p className="font-medium">{String(snapSub?.badgeLabel ?? library?.status ?? '—')}</p>
                  </div>
                  {isTrial && library?.trialEndsAt ? (
                    <div>
                      <span className="text-muted-foreground">Trial ends</span>
                      <p>{fmtDateInput(library.trialEndsAt)}</p>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-muted-foreground">Subscription period</span>
                    <p>
                      {fmtDateInput(
                        snapSub?.startDate ??
                          (billing?.dates as { subscriptionStartsAt?: unknown })?.subscriptionStartsAt,
                      )}{' '}
                      – {fmtDateInput(snapSub?.endDate ?? library?.subscriptionEndsAt)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Days remaining</span>
                    <p>{snapSub?.daysRemaining != null ? String(snapSub.daysRemaining) : '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount due</span>
                    <p className="font-semibold text-amber-700 dark:text-amber-400">
                      {snapSub?.dueAmount != null
                        ? formatCurrency(Number(snapSub.dueAmount))
                        : billing?.dueAmountTotal != null
                          ? formatCurrency(Number(billing.dueAmountTotal))
                          : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )
          ) : null}

          <PlatformPlanSelect
            value={planId}
            onChange={(id, plan) => {
              setPlanId(id);
              setSelectedPlan(plan);
            }}
            disabled={!libraryId}
          />

          {selectedPlan ? (
            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">{selectedPlan.displayName} limits</p>
              <p>
                Seats {selectedPlan.maxSeats} · Branches {selectedPlan.maxBranches} · Staff{' '}
                {selectedPlan.maxStaff} · Storage {selectedPlan.storageLimitMb} MB
              </p>
              {enabledFlags.length ? (
                <p className="mt-1">Features: {enabledFlags.map((f) => f.label).join(', ')}</p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>Billing cycle</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>

          {isTrial ? (
            <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-sm font-medium">Trial → paid conversion</p>
              <p className="text-xs text-muted-foreground">
                Trial ends {fmtDateInput(library?.trialEndsAt)}. Invoice can be paid now; access follows the
                option below.
              </p>
              <fieldset className="space-y-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-3 text-sm has-[:checked]:border-primary">
                  <input
                    type="radio"
                    name="trialPaidStart"
                    className="mt-1"
                    checked={startPaidNow}
                    onChange={() => {
                      setStartPaidNow(true);
                      setStartAfterTrial(false);
                    }}
                  />
                  <span>
                    <span className="font-medium">Start paid plan now</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Paid period begins today. Trial ends and subscription becomes active immediately when
                      invoice is fully paid.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-3 text-sm has-[:checked]:border-primary">
                  <input
                    type="radio"
                    name="trialPaidStart"
                    className="mt-1"
                    checked={!startPaidNow}
                    onChange={() => {
                      setStartPaidNow(false);
                      setStartAfterTrial(true);
                    }}
                  />
                  <span>
                    <span className="font-medium">Start after trial ends</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Library stays on trial until trial end + 1 day. Paid plan is scheduled; invoice can still
                      be collected now.
                    </span>
                  </span>
                </label>
              </fieldset>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="sub-start">Subscription start</Label>
              <Input
                id="sub-start"
                type="date"
                value={subStart}
                onChange={(e) => setSubStart(e.target.value)}
                disabled={billingCycle !== 'CUSTOM'}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sub-end">Subscription end</Label>
              <Input
                id="sub-end"
                type="date"
                value={subEnd}
                onChange={(e) => setSubEnd(e.target.value)}
                disabled={billingCycle !== 'CUSTOM'}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="issue">Issue date</Label>
              <Input id="issue" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due">Due date</Label>
              <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Payment due by {fmtDateInput(dueDate)}</p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amt">Invoice amount</Label>
            <Input
              id="amt"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountOverride(true);
              }}
              disabled={billingCycle !== 'CUSTOM' && !amountOverride}
            />
            {billingCycle !== 'CUSTOM' ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={amountOverride}
                  onCheckedChange={(v) => {
                    setAmountOverride(v === true);
                    if (!v && selectedPlan) setAmount(String(planAmountForCycle(selectedPlan, billingCycle)));
                  }}
                />
                Override plan price
              </label>
            ) : null}
          </div>

          <Separator />

          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Initial payment (optional)</p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="paid">Paid amount</Label>
              <Input
                id="paid"
                inputMode="decimal"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Payment method</Label>
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="txn">Transaction ID</Label>
              <Input id="txn" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={allowOverpayment} onCheckedChange={(v) => setAllowOverpayment(v === true)} />
            Allow overpayment
          </label>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span>Invoice amount</span>
              <span className="font-medium">{formatCurrency(amountNum)}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid</span>
              <span className="font-medium">{formatCurrency(paidNum)}</span>
            </div>
            <div className="flex justify-between">
              <span>Due</span>
              <span className="font-medium">{formatCurrency(dueNum)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2">
              <span className="text-muted-foreground">Resulting status</span>
              <Badge variant="outline">{previewStatus}</Badge>
            </div>
          </div>
          </div>
        </ScrollArea>

        <DialogFooter className="shrink-0 border-t bg-background px-6 py-4">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={createM.isPending || !libraryId || !planId || !amount || !subEnd}
            onClick={() => createM.mutate()}
          >
            Create invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
