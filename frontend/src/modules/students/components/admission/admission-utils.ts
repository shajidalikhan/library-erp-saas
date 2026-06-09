import type { FeePlan } from '@/modules/payments/types';
import { getMinimumStartAmount } from '@/modules/membership/partial-plan-utils';
import type { AdmissionFormState } from '../../types-admission';

export function addDaysToDateOnly(isoDate: string, days: number): string {
  if (!isoDate || days <= 0) return isoDate;
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildAdmissionPayload(
  state: AdmissionFormState,
  plan: FeePlan | null,
  options: {
    addMembership: boolean;
    assignSeat: boolean;
    collectPayment: boolean;
    manualEndDate: boolean;
    priceOverride: boolean;
  },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    branchId: state.branchId,
    fullName: state.fullName.trim(),
    email: state.email.trim(),
    gender: state.gender || 'UNSPECIFIED',
    status: 'ACTIVE',
    createLoginAccount: state.createLoginAccount,
  };

  const opt = (key: keyof AdmissionFormState) => {
    const v = state[key];
    if (typeof v === 'string' && v.trim()) {
      if (key === 'dateOfBirth') {
        payload.dateOfBirth = new Date(v).toISOString();
      } else {
        payload[key] = v.trim();
      }
    }
  };

  opt('phone');
  opt('dateOfBirth');
  opt('address');
  opt('city');
  opt('state');
  opt('pincode');
  opt('emergencyContactPhone');
  opt('guardianName');
  opt('guardianPhone');
  opt('aadhaarNumber');
  opt('notes');

  if (state.createLoginAccount && state.temporaryPassword.trim()) {
    payload.temporaryPassword = state.temporaryPassword.trim();
  }

  if (options.addMembership) {
    const membership: Record<string, unknown> = {
      enabled: true,
      shiftId: state.shiftId,
      feePlanId: state.feePlanId,
      startDate: new Date(state.membershipStartDate).toISOString(),
    };
    if (options.manualEndDate && state.membershipEndDate) {
      membership.endDate = new Date(state.membershipEndDate).toISOString();
    }
    if (options.priceOverride && state.amountOverride.trim()) {
      membership.amountOverride = Number(state.amountOverride);
    }
    payload.membership = membership;
  }

  if (options.assignSeat && state.seatId) {
    payload.seatAssignment = {
      enabled: true,
      seatId: state.seatId,
      shiftId: state.seatShiftId || state.shiftId,
    };
  }

  if (options.collectPayment) {
    const paid = Number(state.paidAmount) || 0;
    payload.payment = {
      enabled: true,
      paidAmount: paid,
      method: paid > 0 ? state.paymentMethod : undefined,
      transactionId: state.transactionId.trim() || undefined,
      notes: state.paymentNotes.trim() || undefined,
    };
  }

  void plan;
  return payload;
}

export function admissionInvoiceTotal(state: AdmissionFormState, plan: FeePlan | null): number {
  if (!plan) return Number(state.amountOverride) || 0;
  if (plan.allowManualPriceOverride && state.amountOverride.trim()) {
    return Number(state.amountOverride) || plan.amount;
  }
  return plan.amount;
}

export function admissionMinimumPayment(plan: FeePlan | null, invoiceTotal: number): number {
  if (!plan?.allowPartialStart) return invoiceTotal;
  return getMinimumStartAmount(plan, invoiceTotal);
}

export function validateAdmissionPayment(
  plan: FeePlan | null,
  invoiceTotal: number,
  paidAmount: number,
): string | null {
  if (paidAmount <= 0) return null;
  if (paidAmount > invoiceTotal) return 'Paid amount cannot exceed invoice total';
  const minimum = admissionMinimumPayment(plan, invoiceTotal);
  if (plan?.allowPartialStart && paidAmount < minimum) {
    return `Minimum payment required to start this plan is ₹${minimum}.`;
  }
  if (!plan?.allowPartialStart && paidAmount < invoiceTotal) {
    return 'Full plan amount is required for this fee plan';
  }
  return null;
}
