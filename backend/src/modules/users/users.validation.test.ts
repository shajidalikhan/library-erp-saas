import { describe, expect, it } from 'vitest';

import { createUserBodySchema } from './users.validation';
import { ROLES } from '@constants/roles.constants';

const libId = '507f1f77bcf86cd799439011';
const branchId = '507f1f77bcf86cd799439012';

describe('createUserBodySchema', () => {
  it('accepts staff user with libraryId and branchId', () => {
    const parsed = createUserBodySchema.parse({
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'TempPass1',
      role: ROLES.MANAGER,
      libraryId: libId,
      branchId,
    });
    expect(parsed.role).toBe(ROLES.MANAGER);
    expect(parsed.libraryId).toBe(libId);
  });

  it('rejects staff without libraryId', () => {
    expect(() =>
      createUserBodySchema.parse({
        fullName: 'Test User',
        email: 'test@example.com',
        password: 'TempPass1',
        role: ROLES.MANAGER,
        branchId,
      }),
    ).toThrow();
  });

  it('rejects SUPER_ADMIN with libraryId', () => {
    expect(() =>
      createUserBodySchema.parse({
        fullName: 'Admin',
        email: 'a@example.com',
        password: 'TempPass1',
        role: ROLES.SUPER_ADMIN,
        libraryId: libId,
      }),
    ).toThrow(/libraryId must be empty/);
  });

  it('rejects SUPER_ADMIN with branchId', () => {
    expect(() =>
      createUserBodySchema.parse({
        fullName: 'Admin',
        email: 'a@example.com',
        password: 'TempPass1',
        role: ROLES.SUPER_ADMIN,
        branchId,
      }),
    ).toThrow(/branchId must be empty/);
  });

  it('accepts SUPER_ADMIN with no tenant fields', () => {
    const parsed = createUserBodySchema.parse({
      fullName: 'Admin',
      email: 'a@example.com',
      password: 'TempPass1',
      role: ROLES.SUPER_ADMIN,
    });
    expect(parsed.libraryId).toBeUndefined();
  });

  it('rejects LIBRARY_OWNER without libraryId', () => {
    expect(() =>
      createUserBodySchema.parse({
        fullName: 'Owner',
        email: 'o@example.com',
        password: 'TempPass1',
        role: ROLES.LIBRARY_OWNER,
      }),
    ).toThrow(/libraryId is required/);
  });

  it('accepts LIBRARY_OWNER with libraryId only', () => {
    const parsed = createUserBodySchema.parse({
      fullName: 'Owner',
      email: 'o@example.com',
      password: 'TempPass1',
      role: ROLES.LIBRARY_OWNER,
      libraryId: libId,
    });
    expect(parsed.libraryId).toBe(libId);
  });

  it('rejects owner role with branchId', () => {
    expect(() =>
      createUserBodySchema.parse({
        fullName: 'Owner',
        email: 'o@example.com',
        password: 'TempPass1',
        role: ROLES.LIBRARY_OWNER,
        libraryId: libId,
        branchId,
      }),
    ).toThrow(/branchId must be empty/);
  });

  it('rejects STUDENT role', () => {
    expect(() =>
      createUserBodySchema.parse({
        fullName: 'Student',
        email: 's@example.com',
        password: 'TempPass1',
        role: ROLES.STUDENT,
        libraryId: libId,
        branchId,
      }),
    ).toThrow(/Invalid role/);
  });
});
