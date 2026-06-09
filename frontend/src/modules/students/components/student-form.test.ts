import { describe, expect, it } from 'vitest';

import type { StudentFormValues } from '../student.validation';

function buildEditPayload(
  values: StudentFormValues,
  seatDraft?: { seatId: string | null; shiftId: string; touched: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    phone: values.phone?.trim(),
  };

  if (seatDraft?.touched) {
    payload.assignedSeatId = seatDraft.seatId;
    if (seatDraft.seatId && seatDraft.shiftId) payload.shiftId = seatDraft.shiftId;
  }

  return payload;
}

describe('student edit payload', () => {
  it('does not send seat assignment when seat was not changed', () => {
    const payload = buildEditPayload(
      {
        branchId: 'b1',
        fullName: 'A',
        email: 'a@test.com',
        phone: '999',
        gender: 'UNSPECIFIED',
        emergencyContactPhone: '888',
        guardianName: '',
        guardianPhone: '',
        aadhaarNumber: 'ID-1',
        status: 'ACTIVE',
        createLoginAccount: false,
        temporaryPassword: '',
      },
      { seatId: 'seat-1', shiftId: 'shift-1', touched: false },
    );

    expect(payload.assignedSeatId).toBeUndefined();
    expect(payload.shiftId).toBeUndefined();
  });
});
