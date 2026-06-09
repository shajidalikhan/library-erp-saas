'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { FeePlanSelect } from '@/components/selectors/fee-plan-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { StudentSelect } from '@/components/selectors/student-select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { PAYMENTS_INVOICES, paymentInvoiceRoute } from '@/constants/routes';
import { ApiError } from '@/lib/api-error';
import { formatCurrency } from '@/lib/utils';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore } from '@/store/auth.store';
import { paymentApi } from '@/modules/payments/payment.service';
import type { FeePlan } from '@/modules/payments/types';

const BRANCH_STAFF = new Set<string>([ROLES.MANAGER, ROLES.RECEPTIONIST, ROLES.ACCOUNTANT]);

export default function NewInvoicePage() {
  const router = useRouter();
  const { can } = usePermissions();
  const user = useAuthStore((s) => s.user);

  const isSuper = user?.role === ROLES.SUPER_ADMIN;
  const isOwner = user?.role === ROLES.LIBRARY_OWNER;
  const isBranchStaff = user?.role ? BRANCH_STAFF.has(user.role) : false;

  const [libraryId, setLibraryId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [feePlanId, setFeePlanId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<FeePlan | null>(null);
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    if (isSuper) {
      setBranchId('');
      setStudentId('');
      setFeePlanId(null);
      setSelectedPlan(null);
    }
  }, [isSuper, libraryId]);

  useEffect(() => {
    setStudentId('');
    setFeePlanId(null);
    setSelectedPlan(null);
    setAmount('');
  }, [branchId]);

  const onFeePlanChange = (id: string | null, plan?: FeePlan | null) => {
    setFeePlanId(id);
    setSelectedPlan(plan ?? null);
    if (plan) {
      setAmount(String(plan.amount));
    } else {
      setAmount('');
    }
  };

  if (!can(PERMISSIONS.PAYMENT_CREATE)) {
    return <p className="text-sm text-muted-foreground">You do not have permission to create invoices.</p>;
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
        Your account must be linked to a branch to create invoices for students in that branch.
      </p>
    );
  }

  const ownerNeedsBranchPick = isOwner && !user?.branchId;
  const branchLocked = isBranchStaff || (!!user?.branchId && !ownerNeedsBranchPick);

  const needsAmount = !feePlanId;
  const amountOk = !needsAmount || (amount !== '' && !Number.isNaN(Number(amount)) && Number(amount) >= 0);

  const canSubmit =
    Boolean(branchId && studentId && dueDate) &&
    amountOk &&
    (isSuper ? Boolean(libraryId) : true);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New invoice"
        actions={
          <Button variant="outline" asChild>
            <Link href={PAYMENTS_INVOICES}>Back</Link>
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Tenant & student</CardTitle>
          <CardDescription>
            {isSuper
              ? 'Select library and branch, then pick the student to bill.'
              : ownerNeedsBranchPick
                ? 'Select branch, then pick the student.'
                : 'Student list is limited to your library and branch.'}
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

          <StudentSelect
            libraryId={libraryId || null}
            branchId={branchId || null}
            value={studentId}
            onChange={(id) => setStudentId(id)}
            disabled={!branchId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>Optional fee plan auto-fills amount; otherwise enter an amount manually.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FeePlanSelect
            libraryId={libraryId || null}
            branchId={branchId || null}
            value={feePlanId}
            onChange={onFeePlanChange}
            disabled={!branchId}
          />

          {selectedPlan ? (
            <Card className="border-dashed bg-muted/30">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Selected plan</CardTitle>
                <CardDescription>{selectedPlan.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 pb-3 text-sm">
                <p>
                  <span className="text-muted-foreground">Amount: </span>
                  {formatCurrency(selectedPlan.amount, 'INR')}
                </p>
                <p>
                  <span className="text-muted-foreground">Duration: </span>
                  {selectedPlan.durationDays} days
                </p>
                {selectedPlan.description ? (
                  <p className="text-muted-foreground">{selectedPlan.description}</p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="inv-amount">{feePlanId ? 'Amount (from plan, editable)' : 'Amount (INR)'}</Label>
            <Input
              id="inv-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!branchId}
              placeholder={feePlanId ? '' : 'Required when no fee plan'}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-due">Due date</Label>
            <Input id="inv-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1"
              loading={pending}
              disabled={!canSubmit}
              onClick={async () => {
                if (!branchId || !studentId) {
                  toast.error('Branch and student are required.');
                  return;
                }
                if (needsAmount && (amount === '' || Number(amount) < 0)) {
                  toast.error('Enter a valid amount or select a fee plan.');
                  return;
                }
                try {
                  setPending(true);
                  const inv = await paymentApi.createInvoice({
                    ...(isSuper ? { libraryId } : {}),
                    branchId,
                    studentId,
                    feePlanId: feePlanId ?? undefined,
                    amount: feePlanId ? (amount === '' ? undefined : Number(amount)) : Number(amount),
                    dueDate: new Date(dueDate).toISOString(),
                    status: 'UNPAID',
                  });
                  toast.success('Invoice created');
                  router.push(paymentInvoiceRoute(inv._id));
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : 'Failed to create invoice');
                } finally {
                  setPending(false);
                }
              }}
            >
              Create invoice
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
