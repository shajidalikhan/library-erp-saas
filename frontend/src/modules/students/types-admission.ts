import type { FeePlan, Invoice, PaymentRecord } from '@/modules/payments/types';
import type { Student } from './types';

export type AdmissionResult = {
  student: Student;
  membership: Record<string, unknown> | null;
  seatAssignment: Record<string, unknown> | null;
  invoice: Invoice | null;
  payment: PaymentRecord | null;
  receipt: PaymentRecord | null;
};

export type AdmissionFormState = {
  branchId: string;
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  guardianName: string;
  guardianPhone: string;
  aadhaarNumber: string;
  notes: string;
  createLoginAccount: boolean;
  temporaryPassword: string;
  addMembership: boolean;
  shiftId: string;
  feePlanId: string;
  membershipStartDate: string;
  membershipEndDate: string;
  amountOverride: string;
  assignSeat: boolean;
  seatId: string;
  seatShiftId: string;
  collectPayment: boolean;
  paidAmount: string;
  paymentMethod: string;
  transactionId: string;
  paymentNotes: string;
};
