import { describe, expect, it } from 'vitest';
import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';

import { __libraryTestables } from './library.service';
import type { IBranchDocument } from './branch.model';

const { assertBranchMutation, assertBranchAccessRead, branchLibraryFilter } = __libraryTestables;

const makeUser = (over: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'u1',
  role: ROLES.MANAGER,
  permissions: [PERMISSIONS.BRANCH_READ, PERMISSIONS.BRANCH_UPDATE],
  libraryId: '507f1f77bcf86cd799439011',
  branchId: '507f1f77bcf86cd799439012',
  ...over,
});

const makeBranch = (): IBranchDocument =>
  ({
    _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    libraryId: new Types.ObjectId('507f1f77bcf86cd799439011'),
    branchName: 'HQ',
    branchCode: 'HQ',
    managerId: null,
    email: 'hq@example.com',
    totalSeats: 10,
    active: true,
  }) as unknown as IBranchDocument;

describe('library.service RBAC helpers', () => {
  it('allows super admin to mutate any branch', () => {
    const u = makeUser({ role: ROLES.SUPER_ADMIN, libraryId: null, branchId: null });
    expect(() => assertBranchMutation(u, '507f1f77bcf86cd799439011', makeBranch(), 'update')).not.toThrow();
  });

  it('allows library owner to update branch inside tenant', () => {
    const u = makeUser({ role: ROLES.LIBRARY_OWNER, branchId: null });
    expect(() => assertBranchMutation(u, '507f1f77bcf86cd799439011', makeBranch(), 'update')).not.toThrow();
  });

  it('blocks manager from deleting branches', () => {
    const u = makeUser({ role: ROLES.MANAGER });
    expect(() => assertBranchMutation(u, '507f1f77bcf86cd799439011', makeBranch(), 'delete')).toThrow(
      'Managers cannot delete branches',
    );
  });

  it('blocks manager from reading another branch', () => {
    const u = makeUser({ role: ROLES.MANAGER, branchId: '507f1f77bcf86cd799439099' });
    expect(() => assertBranchAccessRead(u, '507f1f77bcf86cd799439011', makeBranch())).toThrow(
      'assigned branch',
    );
  });

  it('scopes branch list filter for managers', () => {
    const u = makeUser({ role: ROLES.MANAGER });
    const f = branchLibraryFilter(u, '507f1f77bcf86cd799439011');
    expect(f).toMatchObject({
      libraryId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    });
  });

  it('scopes branch list filter for receptionists with branch assignment', () => {
    const u = makeUser({ role: ROLES.RECEPTIONIST });
    const f = branchLibraryFilter(u, '507f1f77bcf86cd799439011');
    expect(f).toMatchObject({
      libraryId: new Types.ObjectId('507f1f77bcf86cd799439011'),
      _id: new Types.ObjectId('507f1f77bcf86cd799439012'),
    });
  });

  it('allows library owner to list all branches in library filter', () => {
    const u = makeUser({ role: ROLES.LIBRARY_OWNER, branchId: null });
    const f = branchLibraryFilter(u, '507f1f77bcf86cd799439011');
    expect(f).toEqual({ libraryId: new Types.ObjectId('507f1f77bcf86cd799439011') });
  });
});
