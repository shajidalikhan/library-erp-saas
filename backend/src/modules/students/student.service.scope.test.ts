import { describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';

import { __studentTestables } from './student.service';

const { applyListScope, projectStudent } = __studentTestables;

const user = (over: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'u1',
  role: ROLES.MANAGER,
  permissions: [PERMISSIONS.STUDENT_READ],
  libraryId: '507f1f77bcf86cd799439011',
  branchId: '507f1f77bcf86cd799439012',
  ...over,
});

describe('student.service tenant scope', () => {
  it('forces branch filter for branch-bound staff', () => {
    const { filter } = applyListScope(user({}), {});
    expect(filter).toMatchObject({
      libraryId: expect.anything(),
      branchId: expect.anything(),
    });
  });

  it('allows super admin to omit library filter when not specified', () => {
    const { filter } = applyListScope(
      user({ role: ROLES.SUPER_ADMIN, libraryId: null, branchId: null }),
      {},
    );
    expect(Object.keys(filter)).toHaveLength(0);
  });

  it('projects limited fields for basic read permission', () => {
    const u = user({
      permissions: [PERMISSIONS.STUDENT_READ_BASIC],
    });
    const row = {
      _id: 'x',
      studentId: 'STU-1',
      fullName: 'A',
      email: 'secret@example.com',
      aadhaarNumber: '1234',
      libraryId: 'lib',
      branchId: 'br',
      status: 'ACTIVE',
      membershipEndDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const p = projectStudent(u, row);
    expect(p).not.toHaveProperty('email');
    expect(p).toHaveProperty('fullName', 'A');
  });
});
