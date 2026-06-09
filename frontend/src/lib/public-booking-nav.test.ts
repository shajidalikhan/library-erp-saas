import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { canShowNavigationItem } from '@/lib/can-show-navigation';
import { PRIMARY_NAV } from '@/constants/navigation';
import { evaluatePublicBookingNavVisibility } from '@/lib/public-booking-nav';

const publicBookingItem = PRIMARY_NAV.flatMap((s) => s.items).find((i) => i.label === 'Public Booking')!;

describe('Public Booking sidebar visibility', () => {
  const ownerPerms = [PERMISSIONS.BOOKING_READ, PERMISSIONS.PUBLIC_PAGE_MANAGE];

  it('shows when override enables public_booking on snapshot', () => {
    const ctx = {
      role: ROLES.LIBRARY_OWNER,
      permissions: [...ownerPerms],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: false },
      enabledFeaturesOverride: ['public_booking'],
      roleCapabilities: {
        public_booking: { view: true, manage: true, approve: true, convert: true },
      },
    };
    const debug = evaluatePublicBookingNavVisibility(ctx);
    expect(debug.finalVisible).toBe(true);
    expect(canShowNavigationItem(publicBookingItem, ctx)).toBe(true);
  });

  it('hides when public_booking is false', () => {
    const ctx = {
      role: ROLES.LIBRARY_OWNER,
      permissions: [...ownerPerms],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: false },
      roleCapabilities: {
        public_booking: { view: true, manage: true, approve: true, convert: true },
      },
    };
    expect(canShowNavigationItem(publicBookingItem, ctx)).toBe(false);
  });

  it('hides for manager when booking permissions are missing', () => {
    const ctx = {
      role: ROLES.MANAGER,
      permissions: [],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: true },
      roleCapabilities: {
        public_booking: { view: true, manage: true, approve: true, convert: true },
      },
    };
    expect(canShowNavigationItem(publicBookingItem, ctx)).toBe(false);
  });

  it('hides for manager when role capability view is off', () => {
    const ctx = {
      role: ROLES.MANAGER,
      permissions: [PERMISSIONS.BOOKING_READ],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: true },
      roleCapabilities: {
        public_booking: { view: false, manage: false, approve: false, convert: false },
      },
    };
    expect(canShowNavigationItem(publicBookingItem, ctx)).toBe(false);
  });
});
