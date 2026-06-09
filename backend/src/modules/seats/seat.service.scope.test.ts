import { describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';

import { __seatTestables } from './seat.service';
import { listSeatsQuerySchema } from './seat.validation';

const { applyListScope, canAccessSeatList, hasFullSeatRead } = __seatTestables;

const user = (o: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'u1',
  role: ROLES.MANAGER,
  permissions: [PERMISSIONS.SEAT_READ],
  libraryId: '507f1f77bcf86cd799439011',
  branchId: '507f1f77bcf86cd799439012',
  ...o,
});

describe('seat.service scope', () => {
  it('super admin list filter accepts libraryId from query', () => {
    const query = listSeatsQuerySchema.parse({ libraryId: '507f1f77bcf86cd799439011' });
    const f = applyListScope(user({ role: ROLES.SUPER_ADMIN, libraryId: null, branchId: null }), query);
    expect(f.filter.libraryId).toBeDefined();
  });

  it('manager filter pins branch', () => {
    const query = listSeatsQuerySchema.parse({});
    const f = applyListScope(user({}), query);
    expect(String(f.filter.branchId)).toBe('507f1f77bcf86cd799439012');
  });

  it('occupancy read grants list', () => {
    expect(
      canAccessSeatList(
        user({ permissions: [PERMISSIONS.SEAT_OCCUPANCY_READ], role: ROLES.SECURITY }),
      ),
    ).toBe(true);
    expect(hasFullSeatRead(user({ permissions: [PERMISSIONS.SEAT_OCCUPANCY_READ] }))).toBe(false);
  });
});
