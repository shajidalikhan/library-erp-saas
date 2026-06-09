'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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
import { ApiError } from '@/lib/api-error';
import { PlatformPlanSelect } from '@/modules/platform/components/platform-plan-select';
import { platformApi } from '@/modules/platform/platform.service';
import { invalidateSubscriptionQueries } from '@/modules/subscription/subscription-invalidate';
import { subscriptionQueryKeys } from '@/modules/subscription/subscription-query-keys';

export interface AdjustSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraryId: string;
}

export function AdjustSubscriptionDialog({
  open,
  onOpenChange,
  libraryId,
}: AdjustSubscriptionDialogProps) {
  const qc = useQueryClient();
  const subQ = useQuery({
    queryKey: subscriptionQueryKeys.librarySnapshot(libraryId),
    queryFn: () => platformApi.subscriptionSnapshot(libraryId),
    enabled: open && Boolean(libraryId),
  });

  const snap = subQ.data as Record<string, unknown> | undefined;
  const sub = (snap?.subscription ?? snap) as Record<string, unknown> | undefined;
  const record = snap?.subscriptionRecord as Record<string, unknown> | undefined;

  const [planId, setPlanId] = useState('');
  const [billingCycle, setBillingCycle] = useState('MONTHLY');
  const [status, setStatus] = useState('ACTIVE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [dueAmount, setDueAmount] = useState('');
  const [reason, setReason] = useState('');

  const toDateInput = (value: unknown) =>
    value ? new Date(String(value)).toISOString().slice(0, 10) : '';

  useEffect(() => {
    if (!snap || !open) return;
    const financial = snap.financial as Record<string, unknown> | undefined;
    setPlanId(String(sub?.planId ?? ''));
    setBillingCycle(String(snap.billingCycle ?? sub?.billingCycle ?? 'MONTHLY'));
    setStatus(String(record?.recordStatus ?? sub?.status ?? 'ACTIVE'));
    setStartDate(toDateInput(snap.startDate ?? sub?.startDate));
    setEndDate(toDateInput(snap.endDate ?? sub?.endDate));
    setTrialEndsAt(toDateInput(snap.trialEndsAt ?? sub?.trialEndsAt));
    setDueAmount(String(financial?.dueAmountTotal ?? sub?.dueAmount ?? 0));
  }, [snap, sub, record, open]);

  const saveM = useMutation({
    mutationFn: () =>
      platformApi.adjustLibrarySubscription(libraryId, {
        ...(planId ? { planId } : {}),
        billingCycle,
        status,
        ...(startDate ? { startDate: new Date(startDate).toISOString() } : {}),
        ...(endDate ? { endDate: new Date(endDate).toISOString() } : {}),
        ...(trialEndsAt ? { trialEndsAt: new Date(trialEndsAt).toISOString() } : {}),
        dueAmount: Number(dueAmount) || 0,
        adjustmentReason: reason.trim(),
      }),
    onSuccess: async (data) => {
      const snapshot = (data as { snapshot?: Record<string, unknown> }).snapshot;
      if (snapshot) {
        qc.setQueryData(subscriptionQueryKeys.librarySnapshot(libraryId), snapshot);
      }
      toast.success('Subscription updated');
      onOpenChange(false);
      await invalidateSubscriptionQueries(qc, libraryId);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Update failed'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust subscription</DialogTitle>
        </DialogHeader>
        <p className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Manual changes affect tenant access and billing. Invoice history is not modified.
        </p>
        <div className="grid gap-3 py-2">
          <PlatformPlanSelect value={planId} onChange={(id) => setPlanId(id)} />
          <div className="grid gap-2">
            <Label>Billing cycle</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value)}
            >
              <option value="TRIAL">Trial</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <select
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="TRIALING">Trialing</option>
              <option value="ACTIVE">Active</option>
              <option value="PAST_DUE">Past due</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>End date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Trial ends</Label>
            <Input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Due amount</Label>
            <Input inputMode="decimal" value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Adjustment reason (required)</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this change being made?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saveM.isPending || reason.trim().length < 3}
            onClick={() => saveM.mutate()}
          >
            Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
