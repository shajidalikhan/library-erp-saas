import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLES } from '@/constants/permissions';
import type { AuthUser } from '@/types/auth';

import {
  canAccessPublicBookingPage,
  canViewPublicBookingListTab,
  canViewPublicBookingSettingsTab,
  PUBLIC_BOOKING_MESSAGES,
} from './public-booking-access';

const owner = (overrides: Partial<AuthUser> = {}): AuthUser =>
  ({
    id: '1',
    fullName: 'Owner',
    email: 'o@test.com',
    role: ROLES.LIBRARY_OWNER,
    permissions: [
      PERMISSIONS.BOOKING_READ,
      PERMISSIONS.BOOKING_MANAGE,
      PERMISSIONS.PUBLIC_PAGE_MANAGE,
    ],
    libraryId: 'lib1',
    branchId: null,
    isActive: true,
    isEmailVerified: true,
    lastLoginAt: null,
    createdAt: '',
    updatedAt: '',
    subscriptionFeatures: { public_booking: true },
    roleCapabilities: {
      public_booking: { view: true, manage: true, approve: true, convert: true },
    },
    ...overrides,
  }) as AuthUser;

describe('public-booking-access', () => {
  it('allows owner when subscription and capabilities are enabled', () => {
    expect(canAccessPublicBookingPage(owner()).allowed).toBe(true);
    expect(canViewPublicBookingSettingsTab(owner()).allowed).toBe(true);
    expect(canViewPublicBookingListTab(owner()).allowed).toBe(true);
  });

  it('blocks owner when subscription feature is off', () => {
    const result = canAccessPublicBookingPage(
      owner({ subscriptionFeatures: { public_booking: false } }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(PUBLIC_BOOKING_MESSAGES.subscription);
  });

  it('blocks manager when role capability view is disabled', () => {
    const result = canAccessPublicBookingPage(
      owner({
        role: ROLES.MANAGER,
        permissions: [PERMISSIONS.BOOKING_READ],
        roleCapabilities: {
          public_booking: { view: false, manage: true, approve: true, convert: true },
        },
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(PUBLIC_BOOKING_MESSAGES.roleCapability);
  });

  it('settings tab requires publicPage.manage permission for non-owner staff', () => {
    const result = canViewPublicBookingSettingsTab(
      owner({
        role: 'MANAGER' as AuthUser['role'],
        permissions: [PERMISSIONS.BOOKING_READ],
      }),
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe(PUBLIC_BOOKING_MESSAGES.rbac);
  });

  it('allows owner without booking permissions when feature is enabled via opts', () => {
    const user = owner({ permissions: [], subscriptionFeatures: { public_booking: false } });
    const opts = {
      subscriptionFeatures: { public_booking: true },
      enabledFeaturesOverride: ['public_booking'],
    };
    expect(canAccessPublicBookingPage(user, opts).allowed).toBe(true);
    expect(canViewPublicBookingSettingsTab(user, opts).allowed).toBe(true);
    expect(canViewPublicBookingListTab(user, opts).allowed).toBe(true);
  });

  it('allows owner without JWT permissions when auth effectiveFeatures include public_booking', () => {
    const user = owner({
      permissions: [],
      effectiveFeatures: { public_booking: true },
      subscriptionFeatures: { public_booking: true },
    });
    expect(canAccessPublicBookingPage(user).allowed).toBe(true);
  });
});
