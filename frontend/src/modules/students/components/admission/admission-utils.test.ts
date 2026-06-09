import { describe, expect, it } from 'vitest';

import type { AdmissionFormState } from '../../types-admission';
import { buildAdmissionPayload } from './admission-utils';

const baseState = (): AdmissionFormState => ({
  branchId: 'branch-1',
  fullName: 'Test Student',
  email: 'test@example.com',
  phone: '9999999999',
  gender: 'UNSPECIFIED',
  dateOfBirth: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  emergencyContactName: 'Legacy Name',
  emergencyContactPhone: '8888888888',
  guardianName: '',
  guardianPhone: '',
  aadhaarNumber: '1234-5678',
  notes: '',
  createLoginAccount: false,
  temporaryPassword: '',
  addMembership: false,
  shiftId: '',
  feePlanId: '',
  membershipStartDate: '2026-01-01',
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
});

describe('buildAdmissionPayload', () => {
  it('includes aadhaar reference and a single emergency phone field', () => {
    const payload = buildAdmissionPayload(baseState(), null, {
      addMembership: false,
      assignSeat: false,
      collectPayment: false,
      manualEndDate: false,
      priceOverride: false,
    });

    expect(payload.aadhaarNumber).toBe('1234-5678');
    expect(payload.emergencyContactPhone).toBe('8888888888');
    expect(payload.emergencyContactName).toBeUndefined();
  });
});
