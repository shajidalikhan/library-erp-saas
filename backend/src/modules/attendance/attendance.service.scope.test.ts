import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@/types/express';
import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';

import { __attendanceTestables } from './attendance.service';

const { applyReadScope, calcDurationMinutes, classifyOnCheckout, dateKeyInTimezone } = __attendanceTestables;

const user = (over: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: '507f1f77bcf86cd799439011',
  role: ROLES.MANAGER,
  permissions: [PERMISSIONS.ATTENDANCE_READ],
  libraryId: '507f1f77bcf86cd799439012',
  branchId: '507f1f77bcf86cd799439013',
  ...over,
});

describe('attendance.service helpers', () => {
  it('pins branch filter for manager', () => {
    const f = applyReadScope(
      user({}),
      { page: 1, limit: 20, sortBy: 'date', sortOrder: 'desc' },
    );
    expect(f).toHaveProperty('branchId');
  });

  it('calculates duration in whole minutes', () => {
    const checkInAt = new Date('2026-01-01T10:00:00.000Z');
    const checkOutAt = new Date('2026-01-01T11:45:31.000Z');
    expect(calcDurationMinutes(checkInAt, checkOutAt)).toBe(105);
  });

  it('calculates 148 minutes for 03:17 PM to 05:45 PM same day', () => {
    const checkInAt = new Date('2026-05-31T10:17:00.000Z');
    const checkOutAt = new Date('2026-05-31T12:45:00.000Z');
    expect(calcDurationMinutes(checkInAt, checkOutAt)).toBe(148);
  });

  it('classifies early exit for short sessions', () => {
    const checkInAt = new Date('2026-01-01T08:00:00.000Z');
    const checkOutAt = new Date('2026-01-01T09:30:00.000Z');
    expect(classifyOnCheckout(checkInAt, checkOutAt)).toBe('EARLY_EXIT');
  });

  it('normalizes date key by timezone', () => {
    const d = new Date('2026-01-01T22:30:00.000Z');
    const key = dateKeyInTimezone(d, 'Asia/Kolkata');
    expect(key.toISOString().startsWith('2026-01-02')).toBe(true);
  });
});
