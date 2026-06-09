'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { PAYMENTS_FEE_PLANS } from '@/constants/routes';
import { ApiError } from '@/lib/api-error';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { shiftApi } from '@/modules/shifts/shift.service';
import { paymentApi } from '@/modules/payments/payment.service';
import type { FeePlanType, MinimumStartAmountType } from '@/modules/payments/types';

const BRANCH_STAFF = new Set<string>([ROLES.MANAGER, ROLES.RECEPTIONIST, ROLES.ACCOUNTANT]);

export default function NewFeePlanPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);

  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const isOwner = user?.role === ROLES.LIBRARY_OWNER;
  const isBranchStaff = user?.role ? BRANCH_STAFF.has(user.role) : false;

  const [libraryId, setLibraryId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<FeePlanType>('MEMBERSHIP');
  const [amount, setAmount] = useState('');
  const [durationDays, setDurationDays] = useState('30');
  const [shiftId, setShiftId] = useState('');
  const [allowManualPriceOverride, setAllowManualPriceOverride] = useState(false);
  const [billingDurationMonths, setBillingDurationMonths] = useState('');
  const [allowPartialStart, setAllowPartialStart] = useState(false);
  const [minimumStartAmountType, setMinimumStartAmountType] = useState<MinimumStartAmountType>('ONE_MONTH');
  const [minimumStartAmount, setMinimumStartAmount] = useState('');
  const [partialDueDays, setPartialDueDays] = useState('7');
  const [downgradeIfUnpaid, setDowngradeIfUnpaid] = useState(true);
  const [downgradeDurationDays, setDowngradeDurationDays] = useState('30');
  const [offerLabel, setOfferLabel] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (!isSuper && user.libraryId) {
      setLibraryId(user.libraryId);
    }
    if (isBranchStaff && user.branchId) {
      setBranchId(user.branchId);
    }
    if (!isSuper && !isBranchStaff && user.branchId) {
      setBranchId(user.branchId);
    }
  }, [user, isSuper, isBranchStaff]);

  useEffect(() => {
    if (isSuper) setBranchId('');
  }, [isSuper, libraryId]);

  const ownerNeedsBranchPick = isOwner && !user?.branchId;
  const branchLocked = isBranchStaff || (!!user?.branchId && !ownerNeedsBranchPick);

  const { data: branchShifts = [] } = useQuery({
    queryKey: ['fee-plan-shifts', branchId],
    queryFn: () => shiftApi.list({ branchId, active: 'true' }),
    enabled: Boolean(branchId),
  });

  if (!can(PERMISSIONS.FEE_PLAN_CREATE)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to create fee plans.</p>;
  }

  if (!isSuper && !user?.libraryId) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account is not linked to a library. Ask an administrator to assign library context.
      </p>
    );
  }

  if (isBranchStaff && !user?.branchId) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account must be linked to a branch to create fee plans for that branch.
      </p>
    );
  }

  const canSubmit =
    Boolean(branchId && name.trim() && amount) &&
    (isSuper ? Boolean(libraryId) : true);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="New fee plan"
        actions={
          <Button variant="outline" asChild>
            <Link href={PAYMENTS_FEE_PLANS}>Back</Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Plan details</CardTitle>
          <CardDescription>
            {isSuper
              ? 'Choose the tenant library and branch this plan belongs to.'
              : isOwner && ownerNeedsBranchPick
                ? 'Your library is fixed from your account. Select which branch this plan applies to.'
                : 'Plan is created for your assigned library and branch.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSuper ? (
            <LibrarySelect label="Library" value={libraryId} onChange={(id) => setLibraryId(id)} />
          ) : null}

          <BranchSelect
            label="Branch"
            libraryId={libraryId || null}
            value={branchId}
            onChange={(id) => setBranchId(id)}
            lockedLibraryId={branchLocked ? user?.libraryId ?? null : null}
            lockedBranchId={branchLocked ? user?.branchId ?? null : null}
          />

          <div className="space-y-2">
            <Label htmlFor="fp-type">Type</Label>
            <select
              id="fp-type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as FeePlanType)}
            >
              <option value="REGISTRATION">Registration</option>
              <option value="MEMBERSHIP">Membership</option>
              <option value="REGISTRATION_PLUS_MEMBERSHIP">Registration + membership</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-name">Name</Label>
            <Input id="fp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly membership" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-amount">Amount (INR)</Label>
            <Input id="fp-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-duration">Duration (days)</Label>
            <Input
              id="fp-duration"
              type="number"
              min={1}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-shift">Linked shift (optional)</Label>
            <select
              id="fp-shift"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
            >
              <option value="">Any shift</option>
              {branchShifts.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.startTime}–{s.endTime})
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowManualPriceOverride}
              onChange={(e) => setAllowManualPriceOverride(e.target.checked)}
            />
            Allow manual price override at admission / billing
          </label>
          <div className="space-y-2">
            <Label htmlFor="fp-billing-months">Billing duration (months, optional)</Label>
            <Input
              id="fp-billing-months"
              type="number"
              min={1}
              placeholder="e.g. 6 for 6-month plan"
              value={billingDurationMonths}
              onChange={(e) => setBillingDurationMonths(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fp-offer-label">Offer label (optional)</Label>
            <Input
              id="fp-offer-label"
              placeholder="e.g. 6 Months Membership"
              value={offerLabel}
              onChange={(e) => setOfferLabel(e.target.value)}
            />
          </div>
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">Long-duration partial start</p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowPartialStart}
                onChange={(e) => setAllowPartialStart(e.target.checked)}
              />
              Allow admission with minimum first payment
            </label>
            {allowPartialStart ? (
              <>
                <div className="space-y-2">
                  <Label>Minimum start amount type</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={minimumStartAmountType}
                    onChange={(e) => setMinimumStartAmountType(e.target.value as MinimumStartAmountType)}
                  >
                    <option value="ONE_MONTH">One month equivalent</option>
                    <option value="FIXED">Fixed amount</option>
                    <option value="PERCENTAGE">Percentage of total</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Minimum start amount / percentage</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder={minimumStartAmountType === 'PERCENTAGE' ? 'e.g. 20 for 20%' : 'e.g. 2200'}
                    value={minimumStartAmount}
                    onChange={(e) => setMinimumStartAmount(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Due period (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={partialDueDays}
                      onChange={(e) => setPartialDueDays(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Downgrade duration (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={downgradeDurationDays}
                      onChange={(e) => setDowngradeDurationDays(e.target.value)}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={downgradeIfUnpaid}
                    onChange={(e) => setDowngradeIfUnpaid(e.target.checked)}
                  />
                  Downgrade to shorter duration if remaining unpaid by due date
                </label>
              </>
            ) : null}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              loading={pending}
              disabled={!canSubmit}
              onClick={async () => {
                try {
                  setPending(true);
                  await paymentApi.createFeePlan({
                    ...(isSuper ? { libraryId } : {}),
                    branchId,
                    name: name.trim(),
                    type,
                    amount: Number(amount),
                    durationDays: Math.max(1, Math.floor(Number(durationDays) || 30)),
                    billingDurationMonths: billingDurationMonths
                      ? Math.max(1, Math.floor(Number(billingDurationMonths)))
                      : null,
                    shiftId: shiftId || null,
                    allowManualPriceOverride,
                    allowPartialStart,
                    minimumStartAmountType: allowPartialStart ? minimumStartAmountType : null,
                    minimumStartAmount:
                      allowPartialStart && minimumStartAmount.trim()
                        ? Number(minimumStartAmount)
                        : null,
                    partialDueDays: allowPartialStart
                      ? Math.max(1, Math.floor(Number(partialDueDays) || 7))
                      : null,
                    downgradeIfUnpaid,
                    downgradeDurationDays: Math.max(1, Math.floor(Number(downgradeDurationDays) || 30)),
                    offerLabel: offerLabel.trim() || null,
                  });
                  toast.success('Fee plan created');
                  router.push(PAYMENTS_FEE_PLANS);
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : 'Failed to create fee plan');
                } finally {
                  setPending(false);
                }
              }}
            >
              Create
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
