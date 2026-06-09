import { describe, expect, it } from 'vitest';

import {
  attendanceListQuerySchema,
  attendanceQrTokenBodySchema,
  checkInBodySchema,
  checkOutBodySchema,
  manualEntryBodySchema,
} from './attendance.validation';

describe('attendance.validation', () => {
  it('accepts check-in payload', () => {
    const v = checkInBodySchema.parse({
      studentId: '507f1f77bcf86cd799439011',
      method: 'MANUAL',
    });
    expect(v.method).toBe('MANUAL');
  });

  it('rejects invalid ObjectId in check-out', () => {
    expect(() =>
      checkOutBodySchema.parse({
        studentId: 'x',
      }),
    ).toThrow();
  });

  it('rejects manual entry when checkout before checkin', () => {
    expect(() =>
      manualEntryBodySchema.parse({
        studentId: '507f1f77bcf86cd799439011',
        checkInAt: '2026-01-02T10:00:00.000Z',
        checkOutAt: '2026-01-02T09:00:00.000Z',
      }),
    ).toThrow();
  });

  it('parses list query filters', () => {
    const v = attendanceListQuerySchema.parse({
      activeOnly: 'true',
      sortBy: 'checkInAt',
      sortOrder: 'asc',
    });
    expect(v.activeOnly).toBe(true);
    expect(v.sortBy).toBe('checkInAt');
  });

  it('accepts QR token body', () => {
    const v = attendanceQrTokenBodySchema.parse({
      qrToken: 'a'.repeat(40),
    });
    expect(v.qrToken.length).toBe(40);
  });
});
