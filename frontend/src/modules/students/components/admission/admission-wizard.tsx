'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, ChevronRight, Loader2, MapPin, X } from 'lucide-react';

import { FeePlanSelect } from '@/components/selectors/fee-plan-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatCurrency } from '@/lib/utils';
import type { FeePlan } from '@/modules/payments/types';
import { shiftApi } from '@/modules/shifts/shift.service';
import type { StudentFileUploads } from '../../student.service';
import type { AdmissionFormState, AdmissionResult } from '../../types-admission';
import {
  addDaysToDateOnly,
  admissionInvoiceTotal,
  admissionMinimumPayment,
  buildAdmissionPayload,
  todayDateOnly,
  validateAdmissionPayment,
} from './admission-utils';
import {
  formatPlanDurationLabel,
  resolvePartialDueDays,
} from '@/modules/membership/partial-plan-utils';
import { SeatSelectModal } from './seat-select-modal';

const STEPS = ['Identity', 'Membership & fee', 'Seat', 'Payment', 'Review'] as const;
const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'WALLET', 'OTHER'] as const;

export type BranchOption = { _id: string; branchName: string; branchCode: string };

function emptyState(branchId: string): AdmissionFormState {
  const today = todayDateOnly();
  return {
    branchId,
    fullName: '',
    email: '',
    phone: '',
    gender: 'UNSPECIFIED',
    dateOfBirth: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    guardianName: '',
    guardianPhone: '',
    aadhaarNumber: '',
    notes: '',
    createLoginAccount: false,
    temporaryPassword: '',
    addMembership: false,
    shiftId: '',
    feePlanId: '',
    membershipStartDate: today,
    membershipEndDate: '',
    amountOverride: '',
    assignSeat: false,
    seatId: '',
    seatShiftId: '',
    collectPayment: false,
    paidAmount: '',
    paymentMethod: 'CASH',
    transactionId: '',
    paymentNotes: '',
  };
}

export interface AdmissionWizardProps {
  libraryId: string;
  branches: BranchOption[];
  canMembership: boolean;
  canAssignSeat: boolean;
  canPayment: boolean;
  canOverrideDates: boolean;
  canOverridePrice: boolean;
  initialState?: Partial<AdmissionFormState>;
  onSubmit: (payload: Record<string, unknown>, files?: StudentFileUploads) => Promise<AdmissionResult>;
}

export function AdmissionWizard({
  libraryId,
  branches,
  canMembership,
  canAssignSeat,
  canPayment,
  canOverrideDates,
  canOverridePrice,
  initialState,
  onSubmit,
}: AdmissionWizardProps) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<AdmissionFormState>(() =>
    emptyState(branches[0]?._id ?? ''),
  );
  const [feePlan, setFeePlan] = useState<FeePlan | null>(null);
  const [selectedSeatLabel, setSelectedSeatLabel] = useState('');
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const photoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [documentProof, setDocumentProof] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!initialState) return;
    setState((prev) => ({ ...prev, ...initialState }));
    if (initialState.seatId) setSelectedSeatLabel(initialState.seatId);
  }, [initialState]);

  const patch = (partial: Partial<AdmissionFormState>) => setState((s) => ({ ...s, ...partial }));

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery({
    queryKey: ['admission-shifts', state.branchId],
    queryFn: () => shiftApi.list({ branchId: state.branchId, active: 'true' }),
    enabled: Boolean(state.branchId),
  });

  const invoiceTotal = useMemo(
    () => (state.addMembership ? admissionInvoiceTotal(state, feePlan) : 0),
    [state, feePlan],
  );

  const paidNum = Number(state.paidAmount) || 0;
  const dueAmount = Math.max(0, invoiceTotal - paidNum);
  const minimumPayment = feePlan ? admissionMinimumPayment(feePlan, invoiceTotal) : invoiceTotal;
  const remainingDue = Math.max(0, invoiceTotal - minimumPayment);
  const partialDueDays = feePlan ? resolvePartialDueDays(feePlan) : 7;

  const onPlanChange = (id: string | null, plan?: FeePlan | null) => {
    patch({ feePlanId: id ?? '' });
    setFeePlan(plan ?? null);
    if (plan) {
      patch({
        amountOverride: plan.allowManualPriceOverride ? String(plan.amount) : '',
        membershipEndDate: addDaysToDateOnly(state.membershipStartDate, plan.durationDays),
        seatShiftId: plan.shiftId ?? state.shiftId,
      });
      if (plan.shiftId) patch({ shiftId: plan.shiftId });
    }
  };

  const onStartDateChange = (v: string) => {
    const end =
      feePlan?.durationDays && !canOverrideDates
        ? addDaysToDateOnly(v, feePlan.durationDays)
        : state.membershipEndDate;
    patch({ membershipStartDate: v, membershipEndDate: end });
  };

  const validateStep = (idx: number): string | null => {
    if (idx === 0) {
      if (!state.branchId) return 'Select a branch';
      if (!state.fullName.trim()) return 'Full name is required';
      if (!state.email.trim()) return 'Email is required';
      if (state.createLoginAccount && state.temporaryPassword.trim().length < 8) {
        return 'Temporary password must be at least 8 characters';
      }
    }
    if (idx === 1 && state.addMembership) {
      if (!canMembership) return 'You cannot create membership';
      if (!state.shiftId) return 'Select a shift';
      if (!state.feePlanId) return 'Select a fee plan';
      if (!state.membershipStartDate) return 'Membership start date is required';
    }
    if (idx === 2 && state.assignSeat) {
      if (!canAssignSeat) return 'You cannot assign seats';
      if (!state.seatId) return 'Select a seat from the grid';
      const shiftForSeat = state.seatShiftId || state.shiftId;
      if (!shiftForSeat) return 'Select a shift for seat assignment';
    }
    if (idx === 3 && state.collectPayment) {
      if (!canPayment) return 'You cannot collect payments';
      if (!state.addMembership) return 'Enable membership to create an invoice';
      if (paidNum > 0 && !state.paymentMethod) return 'Select a payment method';
      const payErr = validateAdmissionPayment(feePlan, invoiceTotal, paidNum);
      if (payErr) return payErr;
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length - 1; i += 1) {
      const err = validateStep(i);
      if (err) {
        setError(err);
        setStep(i);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildAdmissionPayload(state, feePlan, {
        addMembership: state.addMembership,
        assignSeat: state.assignSeat,
        collectPayment: state.collectPayment,
        manualEndDate: canOverrideDates && Boolean(state.membershipEndDate),
        priceOverride:
          canOverridePrice &&
          Boolean(feePlan?.allowManualPriceOverride && state.amountOverride.trim()),
      });
      const files: StudentFileUploads = {};
      if (profilePhoto) files.profilePhoto = profilePhoto;
      if (documentProof) files.documentProof = documentProof;
      await onSubmit(payload, Object.keys(files).length ? files : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Admission failed');
      throw e;
    } finally {
      setSubmitting(false);
    }
  };

  const seatShiftId = state.seatShiftId || state.shiftId;

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              'flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium',
              i === step && 'border-primary bg-primary/10 text-primary',
              i < step && 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400',
              i > step && 'text-muted-foreground',
            )}
          >
            {i < step ? <Check className="h-3 w-3" /> : <span className="w-4 text-center">{i + 1}</span>}
            {label}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === 0 ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle>Student identity</CardTitle>
            <CardDescription>Core profile, contacts, and optional portal login.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="branchId">Branch</Label>
              <select
                id="branchId"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={state.branchId}
                onChange={(e) => patch({ branchId: e.target.value, shiftId: '', feePlanId: '', seatId: '' })}
              >
                {branches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.branchName} ({b.branchCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={state.fullName}
                onChange={(e) => patch({ fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={state.email}
                onChange={(e) => patch({ email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={state.phone} onChange={(e) => patch({ phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={state.gender}
                onChange={(e) => patch({ gender: e.target.value })}
              >
                <option value="UNSPECIFIED">Unspecified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                value={state.dateOfBirth}
                onChange={(e) => patch({ dateOfBirth: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Profile photo</Label>
              <div className="flex flex-wrap items-center gap-4">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="" className="h-20 w-20 rounded-lg border object-cover" />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                    No photo
                  </div>
                )}
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setProfilePhoto(f);
                    setPhotoPreview(f ? URL.createObjectURL(f) : null);
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                  Upload photo
                </Button>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Document proof</Label>
              <input
                ref={docRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => setDocumentProof(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => docRef.current?.click()}>
                {documentProof ? documentProof.name : 'Upload document'}
              </Button>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" value={state.address} onChange={(e) => patch({ address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={state.city} onChange={(e) => patch({ city: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" value={state.state} onChange={(e) => patch({ state: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pincode">Pincode</Label>
              <Input id="pincode" value={state.pincode} onChange={(e) => patch({ pincode: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="aadhaarNumber">Aadhaar / ID reference</Label>
              <Input
                id="aadhaarNumber"
                value={state.aadhaarNumber}
                onChange={(e) => patch({ aadhaarNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="emergencyPhone">Emergency contact phone</Label>
              <Input
                id="emergencyPhone"
                value={state.emergencyContactPhone}
                onChange={(e) => patch({ emergencyContactPhone: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Shown on the student ID card.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardianName">Guardian name</Label>
              <Input
                id="guardianName"
                value={state.guardianName}
                onChange={(e) => patch({ guardianName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guardianPhone">Guardian phone</Label>
              <Input
                id="guardianPhone"
                value={state.guardianPhone}
                onChange={(e) => patch({ guardianPhone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={state.notes}
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2 rounded-md border p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={state.createLoginAccount}
                  onChange={(e) => patch({ createLoginAccount: e.target.checked })}
                />
                Create login account
              </label>
              {state.createLoginAccount ? (
                <div className="space-y-1.5 mt-2">
                  <Label htmlFor="tempPass">Temporary password</Label>
                  <Input
                    id="tempPass"
                    type="password"
                    value={state.temporaryPassword}
                    onChange={(e) => patch({ temporaryPassword: e.target.value })}
                  />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle>Membership & fee</CardTitle>
            <CardDescription>Optional plan linked to shift and invoice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canMembership}
                checked={state.addMembership}
                onChange={(e) => patch({ addMembership: e.target.checked })}
              />
              Add membership now
            </label>
            {!canMembership ? (
              <p className="text-sm text-muted-foreground">Requires membership.create permission.</p>
            ) : null}
            {state.addMembership ? (
              <>
                <div className="space-y-1.5">
                  <Label>Shift</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={state.shiftId}
                    disabled={shiftsLoading}
                    onChange={(e) => {
                      patch({ shiftId: e.target.value, seatShiftId: e.target.value });
                    }}
                  >
                    <option value="">Select shift…</option>
                    {shifts.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.startTime}–{s.endTime})
                      </option>
                    ))}
                  </select>
                </div>
                <FeePlanSelect
                  libraryId={libraryId}
                  branchId={state.branchId}
                  value={state.feePlanId || null}
                  onChange={onPlanChange}
                  label="Fee plan"
                  allowClear={false}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Start date</Label>
                    <Input
                      type="date"
                      value={state.membershipStartDate}
                      onChange={(e) => onStartDateChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End date</Label>
                    <Input
                      type="date"
                      value={state.membershipEndDate}
                      readOnly={!canOverrideDates}
                      onChange={(e) => patch({ membershipEndDate: e.target.value })}
                    />
                    {!canOverrideDates ? (
                      <p className="text-xs text-muted-foreground">Calculated from plan duration.</p>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Fee amount (INR)</Label>
                  <Input
                    type="number"
                    min={0}
                    readOnly={!feePlan?.allowManualPriceOverride || !canOverridePrice}
                    value={
                      feePlan?.allowManualPriceOverride && canOverridePrice
                        ? state.amountOverride || String(feePlan.amount)
                        : feePlan
                          ? String(feePlan.amount)
                          : state.amountOverride
                    }
                    onChange={(e) => patch({ amountOverride: e.target.value })}
                  />
                </div>
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <p className="font-medium">Fee summary</p>
                  <p className="text-muted-foreground">
                    {feePlan?.name ?? 'No plan'} · {formatCurrency(invoiceTotal, 'INR')}
                    {feePlan ? ` · ${formatPlanDurationLabel(feePlan)}` : ''}
                  </p>
                  {feePlan?.allowPartialStart ? (
                    <>
                      <p>Pay now minimum: {formatCurrency(minimumPayment, 'INR')}</p>
                      <p>Remaining due: {formatCurrency(remainingDue, 'INR')}</p>
                      <p>Due by: {partialDueDays} days from admission</p>
                      <p className="text-amber-700 dark:text-amber-400">
                        If unpaid by due date, membership will become{' '}
                        {feePlan.downgradeDurationDays ?? 30} days only.
                      </p>
                    </>
                  ) : null}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle>Seat assignment</CardTitle>
            <CardDescription>Optional seat for the selected shift.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canAssignSeat}
                checked={state.assignSeat}
                onChange={(e) => patch({ assignSeat: e.target.checked })}
              />
              Assign seat now
            </label>
            {state.assignSeat ? (
              <>
                <div className="space-y-1.5">
                  <Label>Shift for occupancy</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={seatShiftId}
                    onChange={(e) => patch({ seatShiftId: e.target.value })}
                  >
                    <option value="">Select shift…</option>
                    {(state.addMembership ? shifts : []).length === 0 && state.shiftId ? (
                      <option value={state.shiftId}>Membership shift</option>
                    ) : null}
                    {shifts.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!seatShiftId}
                  onClick={() => setSeatModalOpen(true)}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Open seat grid
                </Button>
                {state.seatId ? (
                  <div className="flex items-center justify-between rounded-md border p-3 text-sm">
                    <span>
                      Seat <strong>{selectedSeatLabel || state.seatId}</strong>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        patch({ seatId: '' });
                        setSelectedSeatLabel('');
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
                <SeatSelectModal
                  open={seatModalOpen}
                  onOpenChange={setSeatModalOpen}
                  branchId={state.branchId}
                  shiftId={seatShiftId}
                  selectedSeatId={state.seatId}
                  onSelect={(seat) => {
                    patch({ seatId: seat._id });
                    setSelectedSeatLabel(seat.seatNumber);
                  }}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle>Payment</CardTitle>
            <CardDescription>Collect full or partial payment against the admission invoice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canPayment || !state.addMembership}
                checked={state.collectPayment}
                onChange={(e) => patch({ collectPayment: e.target.checked })}
              />
              Collect payment now
            </label>
            {!state.addMembership ? (
              <p className="text-sm text-muted-foreground">Enable membership in step 2 to create an invoice.</p>
            ) : null}
            {state.collectPayment && state.addMembership ? (
              <>
                <p className="text-sm">
                  Invoice total: <strong>{formatCurrency(invoiceTotal, 'INR')}</strong>
                </p>
                {feePlan?.allowPartialStart ? (
                  <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                    <p className="font-medium">
                      {feePlan.offerLabel ?? formatPlanDurationLabel(feePlan)}
                    </p>
                    <p>Pay now minimum: {formatCurrency(minimumPayment, 'INR')}</p>
                    <p>Remaining due: {formatCurrency(remainingDue, 'INR')}</p>
                    <p>Due by: {partialDueDays} days</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {feePlan?.allowPartialStart ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => patch({ paidAmount: String(minimumPayment) })}
                      >
                        Pay minimum
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => patch({ paidAmount: String(invoiceTotal) })}
                      >
                        Pay full
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => patch({ paidAmount: String(invoiceTotal) })}
                    >
                      Pay full
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Paid amount (custom)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={state.paidAmount}
                    onChange={(e) => patch({ paidAmount: e.target.value })}
                  />
                </div>
                {dueAmount > 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Due after payment: {formatCurrency(dueAmount, 'INR')}
                  </p>
                ) : paidNum > 0 ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">Fully paid</p>
                ) : null}
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={state.paymentMethod}
                    onChange={(e) => patch({ paymentMethod: e.target.value })}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Transaction ID (optional)</Label>
                  <Input
                    value={state.transactionId}
                    onChange={(e) => patch({ transactionId: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Input value={state.paymentNotes} onChange={(e) => patch({ paymentNotes: e.target.value })} />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle>Review & create</CardTitle>
            <CardDescription>Confirm details before submitting admission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium">Student</p>
              <p>{state.fullName}</p>
              <p className="text-muted-foreground">{state.email}</p>
              {photoPreview ? <p className="text-xs text-muted-foreground">Profile photo attached</p> : null}
            </div>
            {state.addMembership ? (
              <div className="rounded-md border p-3">
                <p className="font-medium">Membership</p>
                <p>
                  {feePlan?.name} · {state.membershipStartDate} → {state.membershipEndDate}
                </p>
                <p className="text-muted-foreground">{formatCurrency(invoiceTotal, 'INR')}</p>
              </div>
            ) : null}
            {state.assignSeat && state.seatId ? (
              <div className="rounded-md border p-3">
                <p className="font-medium">Seat</p>
                <p>{selectedSeatLabel || 'Selected'}</p>
              </div>
            ) : null}
            {state.collectPayment && state.addMembership ? (
              <div className="rounded-md border p-3">
                <p className="font-medium">Payment</p>
                <p>
                  {formatCurrency(paidNum, 'INR')} collected · due {formatCurrency(dueAmount, 'INR')}
                </p>
              </div>
            ) : state.addMembership ? (
              <p className="text-amber-700 dark:text-amber-400 text-sm">
                Invoice will be created as UNPAID unless you collect payment.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-between">
        <Button type="button" variant="outline" disabled={step === 0 || submitting} onClick={back}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" disabled={submitting} onClick={() => void submit()}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create student'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
