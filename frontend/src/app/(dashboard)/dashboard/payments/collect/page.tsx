'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { FeePlanSelect } from '@/components/selectors/fee-plan-select';
import { InvoiceSelect } from '@/components/selectors/invoice-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { StudentSelect } from '@/components/selectors/student-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { PAYMENTS_INVOICES, paymentInvoiceRoute } from '@/constants/routes';
import { ApiError } from '@/lib/api-error';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { usePreferredBranch } from '@/hooks/use-preferred-branch';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { libraryApi } from '@/modules/library/library.service';
import { paymentApi } from '@/modules/payments/payment.service';
import { paymentQueryKeys } from '@/modules/payments/payment-query-keys';
import { InvoiceStatusBadge } from '@/modules/payments/components/invoice-status-badge';
import { studentApi } from '@/modules/students/student.service';
import type { FeePlan, Invoice } from '@/modules/payments/types';
import type { Student } from '@/modules/students/types';
import {
  formatPlanDurationLabel,
  getMinimumStartAmount,
  resolvePartialDueDays,
  validateCollectPaymentAmount,
} from '@/modules/membership/partial-plan-utils';

const METHODS = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'WALLET', 'OTHER'] as const;

function partialDueDaysLabel(startDateIso: string, days: number): string {
  const d = new Date(`${startDateIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function CollectPaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const {
    effectiveLibraryId,
    effectiveBranchId,
    isSuperAdmin: isSuper,
    isBranchScopedStaff,
    setSuperAdminWorkspace,
  } = useTenantScope();

  const [superLibraryId, setSuperLibraryId] = useState('');
  const [superBranchId, setSuperBranchId] = useState('');
  const [collectMode, setCollectMode] = useState<'student' | 'invoice'>('student');
  const [invoiceId, setInvoiceId] = useState('');
  const [picked, setPicked] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('CASH');
  const [txnId, setTxnId] = useState('');
  const [allowOverpay, setAllowOverpay] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [feePlanId, setFeePlanId] = useState('');
  const [selectedFeePlan, setSelectedFeePlan] = useState<FeePlan | null>(null);
  const [quickAmount, setQuickAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showQuickInvoice, setShowQuickInvoice] = useState(false);

  useEffect(() => {
    const id = searchParams.get('invoiceId') ?? '';
    setInvoiceId(id);
    setPicked(null);
    const sid = searchParams.get('studentId') ?? '';
    setStudentId(sid);
  }, [searchParams]);

  useEffect(() => {
    if (isSuper && effectiveLibraryId) setSuperLibraryId(effectiveLibraryId);
    if (isSuper && effectiveBranchId) setSuperBranchId(effectiveBranchId);
  }, [isSuper, effectiveLibraryId, effectiveBranchId]);

  const resolvedLibraryId = isSuper ? superLibraryId : effectiveLibraryId;

  const fixedBranchId = isBranchScopedStaff ? effectiveBranchId : isSuper ? superBranchId : '';

  const { data: branches } = useQuery({
    queryKey: ['collect-branches', resolvedLibraryId],
    queryFn: () => libraryApi.listBranches(resolvedLibraryId, { limit: 100 }),
    enabled: Boolean(resolvedLibraryId),
  });

  const [tenantBranchId, setTenantBranchId] = usePreferredBranch(resolvedLibraryId, branches?.items, {
    fixedBranchId: fixedBranchId || undefined,
  });

  const resolvedBranchId = isSuper ? superBranchId || tenantBranchId : tenantBranchId;

  const branchReady = Boolean(resolvedLibraryId && resolvedBranchId);
  const tenantScopeReady = branchReady;

  const studentPendingMessage = useMemo(() => {
    if (!resolvedLibraryId) return isSuper ? 'Select a library first.' : 'Your account is not linked to a library.';
    if (!resolvedBranchId) return 'Select a branch first.';
    return '';
  }, [resolvedLibraryId, resolvedBranchId, isSuper]);

  const tenantForList = {
    libraryId: resolvedLibraryId || undefined,
    branchId: resolvedBranchId || undefined,
  };

  const prefetchEnabled =
    Boolean(invoiceId) && !picked && tenantScopeReady;

  const {
    data: invoiceFromUrl,
    isError: invoiceUrlError,
    error: invoiceUrlErr,
    isFetching: invoiceUrlFetching,
  } = useQuery({
    queryKey: paymentQueryKeys.invoices({
      invoiceId,
      hasOpenBalance: true,
      limit: 1,
      page: 1,
      ...tenantForList,
    }),
    queryFn: () =>
      paymentApi.listInvoices({
        invoiceId,
        hasOpenBalance: true,
        limit: 1,
        page: 1,
        ...tenantForList,
      }),
    enabled: prefetchEnabled,
    select: (d) => d.items[0] ?? null,
  });

  const { data: studentFromUrl } = useQuery({
    queryKey: ['collect-student', studentId],
    queryFn: () => studentApi.get(studentId),
    enabled: Boolean(studentId),
  });

  const activeStudent = selectedStudent ?? studentFromUrl ?? null;
  const studentBranchId = activeStudent?.branchId ?? resolvedBranchId;

  const unpaidInvoicesQuery = useQuery({
    queryKey: paymentQueryKeys.invoices({
      studentId: studentId || undefined,
      hasOpenBalance: true,
      limit: 20,
      page: 1,
      libraryId: resolvedLibraryId || undefined,
      branchId: studentBranchId || undefined,
    }),
    queryFn: () =>
      paymentApi.listInvoices({
        studentId,
        hasOpenBalance: true,
        limit: 20,
        page: 1,
        libraryId: resolvedLibraryId || undefined,
        branchId: studentBranchId || undefined,
      }),
    enabled: Boolean(studentId && branchReady),
  });

  const summary = picked ?? invoiceFromUrl ?? null;

  const { data: invoiceFeePlan } = useQuery({
    queryKey: ['collect-fee-plan', summary?.feePlanId, resolvedLibraryId, resolvedBranchId],
    queryFn: async () => {
      const plans = await paymentApi.listFeePlans({
        libraryId: resolvedLibraryId!,
        branchId: resolvedBranchId!,
        active: true,
        limit: 100,
      });
      return plans.items.find((p) => p._id === summary?.feePlanId) ?? null;
    },
    enabled: Boolean(summary?.feePlanId && resolvedLibraryId && resolvedBranchId),
  });

  useEffect(() => {
    if (invoiceFeePlan) setSelectedFeePlan(invoiceFeePlan);
  }, [invoiceFeePlan]);

  const createAndCollectMutation = useMutation({
    mutationFn: async () => {
      if (!activeStudent || !feePlanId) throw new Error('Select student and fee plan');
      const inv = await paymentApi.createInvoice({
        branchId: activeStudent.branchId,
        studentId: activeStudent._id,
        feePlanId,
        amount: quickAmount ? Number(quickAmount) : undefined,
        dueDate: `${dueDate}T00:00:00.000Z`,
        status: 'UNPAID',
      });
      return paymentApi.collect({
        invoiceId: inv._id,
        amount: Number(amount),
        method,
        transactionId: txnId || undefined,
        allowOverpayment: can(PERMISSIONS.PAYMENT_UPDATE) && allowOverpay,
      });
    },
    onSuccess: (d) => {
      toast.success('Invoice created and payment recorded');
      void qc.invalidateQueries({ queryKey: paymentQueryKeys.all });
      router.push(paymentInvoiceRoute(d.invoice._id));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  useEffect(() => {
    if (summary) {
      setAmount(String(summary.dueAmount));
    } else {
      setAmount('');
    }
  }, [summary?._id, summary?.dueAmount]);

  useEffect(() => {
    setShowQuickInvoice(false);
  }, [studentId]);

  const quickInvoiceTotal = useMemo(() => {
    if (!selectedFeePlan) return 0;
    if (quickAmount.trim()) return Number(quickAmount) || selectedFeePlan.amount;
    return selectedFeePlan.amount;
  }, [selectedFeePlan, quickAmount]);

  const quickMinimum = selectedFeePlan?.allowPartialStart
    ? getMinimumStartAmount(selectedFeePlan, quickInvoiceTotal)
    : quickInvoiceTotal;

  const quickPartialDueDays = selectedFeePlan ? resolvePartialDueDays(selectedFeePlan) : 7;

  const due = summary?.dueAmount ?? 0;
  const amtNum = Number(amount);
  const overpayOk = can(PERMISSIONS.PAYMENT_UPDATE) && allowOverpay;
  const amountTooHigh =
    !overpayOk && summary && Number.isFinite(amtNum) && amtNum > due + 0.01;

  const invoiceMinimum =
    summary?.partialMinimumAmount ??
    (selectedFeePlan?.allowPartialStart
      ? getMinimumStartAmount(selectedFeePlan, summary?.totalAmount ?? 0)
      : summary?.totalAmount ?? 0);

  const mut = useMutation({
    mutationFn: () =>
      paymentApi.collect({
        invoiceId,
        amount: amtNum,
        method,
        transactionId: txnId || undefined,
        allowOverpayment: overpayOk,
      }),
    onSuccess: (d) => {
      toast.success('Payment recorded');
      void qc.invalidateQueries({ queryKey: paymentQueryKeys.all });
      router.push(paymentInvoiceRoute(d.invoice._id));
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed'),
  });

  const handleSuperLibraryChange = (id: string) => {
    setSuperLibraryId(id);
    setSuperBranchId('');
    setStudentId('');
    setSelectedStudent(null);
    setInvoiceId('');
    setPicked(null);
    setSuperAdminWorkspace({ libraryId: id, branchId: '' });
  };

  const handleSuperBranchChange = (id: string) => {
    setSuperBranchId(id);
    setStudentId('');
    setSelectedStudent(null);
    setInvoiceId('');
    setPicked(null);
    if (superLibraryId) setSuperAdminWorkspace({ libraryId: superLibraryId, branchId: id });
  };

  const handleTenantBranchChange = (id: string) => {
    setTenantBranchId(id);
    setStudentId('');
    setSelectedStudent(null);
    setInvoiceId('');
    setPicked(null);
  };

  const showOwnerBranchPicker =
    !isSuper && !isBranchScopedStaff && Boolean(branches?.items && branches.items.length > 1);

  const showQuickInvoiceCard =
    collectMode === 'student' &&
    studentId &&
    !unpaidInvoicesQuery.isLoading &&
    (showQuickInvoice || !unpaidInvoicesQuery.data?.items.length);

  const collectValidationError = summary
    ? validateCollectPaymentAmount({
        plan: selectedFeePlan,
        invoiceTotal: summary.totalAmount,
        paymentAmount: amtNum,
        alreadyPaidAmount: summary.paidAmount,
        minimumOverride: summary.partialMinimumAmount,
        allowPartialStart: summary.partialMinimumAmount != null,
      })
    : showQuickInvoiceCard && selectedFeePlan
      ? validateCollectPaymentAmount({
          plan: selectedFeePlan,
          invoiceTotal: quickInvoiceTotal,
          paymentAmount: amtNum,
        })
      : null;

  const canSubmit = Boolean(
    invoiceId &&
      amount !== '' &&
      Number.isFinite(amtNum) &&
      amtNum > 0 &&
      !amountTooHigh &&
      !collectValidationError,
  );

  if (!can(PERMISSIONS.PAYMENT_CREATE)) {
    return <p className="text-sm text-muted-foreground">No payment.create permission.</p>;
  }

  const urlInvoiceBlocked = Boolean(isSuper && searchParams.get('invoiceId') && !tenantScopeReady);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        title="Collect payment"
        description="Collect by student (filtered invoices) or search any open invoice in the branch."
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={collectMode === 'student' ? 'default' : 'outline'}
          onClick={() => setCollectMode('student')}
        >
          By student
        </Button>
        <Button
          type="button"
          size="sm"
          variant={collectMode === 'invoice' ? 'default' : 'outline'}
          onClick={() => {
            setCollectMode('invoice');
            setStudentId('');
            setSelectedStudent(null);
            setShowQuickInvoice(false);
          }}
        >
          By invoice
        </Button>
      </div>

      {isSuper && !tenantScopeReady ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workspace</CardTitle>
            <CardDescription>Select library and branch to collect payments.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <LibrarySelect label="Library" value={superLibraryId} onChange={handleSuperLibraryChange} />
            <BranchSelect
              label="Branch"
              libraryId={superLibraryId || null}
              value={superBranchId}
              onChange={handleSuperBranchChange}
              disabled={!superLibraryId}
            />
          </CardContent>
        </Card>
      ) : null}

      {collectMode === 'student' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student</CardTitle>
            <CardDescription>
              {branchReady
                ? 'Search student by name, phone, student ID, or seat number.'
                : isSuper
                  ? 'Select library and branch above to search students.'
                  : 'Select a branch to search students.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isSuper && tenantScopeReady ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <LibrarySelect label="Library" value={superLibraryId} onChange={handleSuperLibraryChange} />
                <BranchSelect
                  label="Branch"
                  libraryId={superLibraryId || null}
                  value={superBranchId}
                  onChange={handleSuperBranchChange}
                  disabled={!superLibraryId}
                />
              </div>
            ) : null}

            {showOwnerBranchPicker ? (
              <div className="space-y-2">
                <Label htmlFor="collect-branch">Branch</Label>
                <select
                  id="collect-branch"
                  className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
                  value={tenantBranchId}
                  onChange={(e) => handleTenantBranchChange(e.target.value)}
                >
                  <option value="">Branch…</option>
                  {branches!.items.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.branchName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {isBranchScopedStaff && resolvedBranchId ? (
              <BranchSelect
                label="Branch"
                libraryId={resolvedLibraryId || null}
                value={resolvedBranchId}
                onChange={() => {}}
                lockedLibraryId={resolvedLibraryId}
                lockedBranchId={resolvedBranchId}
              />
            ) : null}

            <StudentSelect
              label="Student"
              libraryId={resolvedLibraryId || null}
              branchId={resolvedBranchId || null}
              value={studentId}
              pendingMessage={studentPendingMessage}
              searchPlaceholder="Search student by name, phone, student ID, or seat number"
              onChange={(id, stu) => {
                setStudentId(id);
                setSelectedStudent(stu ?? null);
                setInvoiceId('');
                setPicked(null);
                setShowQuickInvoice(false);
              }}
            />
            {activeStudent ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">{activeStudent.fullName}</p>
                <p className="text-muted-foreground">
                  {activeStudent.studentId}
                  {activeStudent.phone ? ` · ${activeStudent.phone}` : ''}
                </p>
                {activeStudent.seatNumber ? (
                  <p className="text-muted-foreground">Seat {activeStudent.seatNumber}</p>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {collectMode === 'student' && studentId && unpaidInvoicesQuery.data?.items.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Open invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unpaidInvoicesQuery.data.items.map((inv) => (
              <button
                key={inv._id}
                type="button"
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-accent ${
                  invoiceId === inv._id ? 'border-primary bg-accent' : ''
                }`}
                onClick={() => {
                  setInvoiceId(inv._id);
                  setPicked(inv);
                  setShowQuickInvoice(false);
                }}
              >
                <span className="font-mono text-xs">{inv.invoiceNumber}</span>
                <span>Due {formatCurrency(inv.dueAmount, inv.currency ?? 'INR')}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {showQuickInvoiceCard ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick invoice</CardTitle>
            <CardDescription>No open invoice — create one and collect payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FeePlanSelect
              libraryId={resolvedLibraryId || null}
              branchId={studentBranchId || null}
              value={feePlanId}
              onChange={(id, plan) => {
                setFeePlanId(id ?? '');
                setSelectedFeePlan(plan ?? null);
              }}
            />
            {selectedFeePlan?.allowPartialStart ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-medium">
                  {selectedFeePlan.offerLabel ?? formatPlanDurationLabel(selectedFeePlan)}
                </p>
                <p>Total: {formatCurrency(quickInvoiceTotal, 'INR')}</p>
                <p>Minimum to start: {formatCurrency(quickMinimum, 'INR')}</p>
                <p>Remaining: {formatCurrency(Math.max(0, quickInvoiceTotal - quickMinimum), 'INR')}</p>
                <p>Due by: {partialDueDaysLabel(dueDate, quickPartialDueDays)}</p>
              </div>
            ) : null}
            {selectedFeePlan?.allowPartialStart ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAmount(String(quickMinimum))}
                >
                  Pay minimum
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAmount(String(quickInvoiceTotal))}
                >
                  Pay full
                </Button>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-amt">Amount (optional override)</Label>
                <Input
                  id="quick-amt"
                  type="number"
                  min={0}
                  step="0.01"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-due">Due date</Label>
                <Input id="quick-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {urlInvoiceBlocked ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          This link includes an invoice id. As super admin, choose the invoice&apos;s library and branch first so
          results stay tenant-scoped.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Invoice</CardTitle>
          <CardDescription>
            {collectMode === 'student' && studentId
              ? 'Showing open invoices for the selected student only.'
              : 'Search open-balance invoices by number, student name, seat, or phone.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InvoiceSelect
            value={invoiceId}
            selectedInvoice={summary}
            onChange={(id, inv) => {
              setInvoiceId(id);
              setPicked(inv);
              setShowQuickInvoice(false);
            }}
            libraryId={resolvedLibraryId || null}
            branchId={resolvedBranchId || null}
            studentId={collectMode === 'student' ? studentId || null : null}
            disabled={!tenantScopeReady || (collectMode === 'student' && !studentId)}
            onCreateForStudent={
              collectMode === 'student' && studentId
                ? () => setShowQuickInvoice(true)
                : undefined
            }
          />
        </CardContent>
      </Card>

      {searchParams.get('invoiceId') && !picked && prefetchEnabled && invoiceUrlFetching ? (
        <Skeleton className="h-48 w-full" />
      ) : null}
      {invoiceUrlError ? (
        <p className="text-sm text-destructive">
          {invoiceUrlErr instanceof Error ? invoiceUrlErr.message : 'Could not load invoice from link.'}
        </p>
      ) : null}

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice summary</CardTitle>
            <CardDescription className="font-mono text-xs">{summary.invoiceNumber}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Student</span>
              <br />
              <span className="font-medium">{summary.studentName ?? '—'}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Phone</span>
              <br />
              {summary.studentPhone ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Student ID</span>
              <br />
              {summary.studentCode ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Seat</span>
              <br />
              {summary.seatNumber ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Branch</span>
              <br />
              {summary.branchName ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Fee plan</span>
              <br />
              {summary.feePlanName ?? '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Status</span>
              <br />
              <InvoiceStatusBadge status={summary.status} />
            </p>
            <p>
              <span className="text-muted-foreground">Total</span>
              <br />
              {formatCurrency(summary.totalAmount, summary.currency ?? 'INR')}
            </p>
            <p>
              <span className="text-muted-foreground">Paid</span>
              <br />
              {formatCurrency(summary.paidAmount, summary.currency ?? 'INR')}
            </p>
            <p>
              <span className="text-muted-foreground">Due</span>
              <br />
              <span className="font-semibold">{formatCurrency(summary.dueAmount, summary.currency ?? 'INR')}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Due date</span>
              <br />
              {summary.dueDate?.slice(0, 10) ?? '—'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collect-amt">Amount</Label>
            <Input
              id="collect-amt"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {amountTooHigh ? (
              <p className="text-xs text-destructive">
                Amount cannot exceed due balance unless overpayment is allowed.
              </p>
            ) : null}
            {collectValidationError ? (
              <p className="text-xs text-destructive">{collectValidationError}</p>
            ) : null}
            {summary?.partialMinimumAmount != null && summary.downgradeIfUnpaid ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p>Total: {formatCurrency(summary.totalAmount, summary.currency ?? 'INR')}</p>
                <p>Minimum to start: {formatCurrency(invoiceMinimum, summary.currency ?? 'INR')}</p>
                <p>
                  Remaining:{' '}
                  {formatCurrency(Math.max(0, summary.dueAmount), summary.currency ?? 'INR')}
                </p>
                {summary.downgradeDueDate ? (
                  <p>Downgrade due: {summary.downgradeDueDate.slice(0, 10)}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="collect-method">Method</Label>
            <select
              id="collect-method"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={method}
              onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="collect-txn">Transaction ID (optional)</Label>
            <Input id="collect-txn" value={txnId} onChange={(e) => setTxnId(e.target.value)} />
          </div>
          {can(PERMISSIONS.PAYMENT_UPDATE) ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={allowOverpay} onChange={(e) => setAllowOverpay(e.target.checked)} />
              Allow overpayment (finance)
            </label>
          ) : null}
          <Button
            className="w-full"
            loading={mut.isPending || createAndCollectMutation.isPending}
            disabled={
              !canSubmit &&
              !(
                studentId &&
                feePlanId &&
                amount !== '' &&
                Number.isFinite(amtNum) &&
                amtNum > 0 &&
                !collectValidationError &&
                showQuickInvoiceCard
              )
            }
            onClick={() => {
              if (invoiceId && canSubmit) {
                mut.mutate();
              } else if (studentId && feePlanId && showQuickInvoiceCard) {
                createAndCollectMutation.mutate();
              }
            }}
          >
            {showQuickInvoiceCard ? 'Create invoice & collect' : 'Record payment'}
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link href={PAYMENTS_INVOICES}>Back to invoices</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CollectPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-xl space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <CollectPaymentContent />
    </Suspense>
  );
}
