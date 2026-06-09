import { describe, expect, it } from 'vitest';

import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { PRIMARY_NAV } from '@/constants/navigation';
import { canShowNavigationItem } from '@/lib/can-show-navigation';

const managerPermissions = [
  PERMISSIONS.STUDENT_READ,
  PERMISSIONS.SEAT_READ,
  PERMISSIONS.SHIFT_READ,
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.PAYMENT_READ,
  PERMISSIONS.REPORT_VIEW,
] as const;

const attendanceItem = PRIMARY_NAV.flatMap((s) => s.items).find((i) => i.label === 'Attendance')!;
const publicBookingItem = PRIMARY_NAV.flatMap((s) => s.items).find((i) => i.label === 'Public Booking')!;
const duplicateBookingsItem = PRIMARY_NAV.flatMap((s) => s.items).find((i) => i.label === 'Bookings');

describe('canShowNavigationItem', () => {
  it('shows attendance for manager when capability and subscription allow', () => {
    const visible = canShowNavigationItem(attendanceItem, {
      role: ROLES.MANAGER,
      permissions: [...managerPermissions],
      libraryId: 'lib1',
      subscriptionFeatures: { attendance: true },
      roleCapabilities: {
        attendance: { view: true, checkin: true, checkout: true, export: false },
      },
      roleModules: { attendance: true } as never,
    });
    expect(visible).toBe(true);
  });

  it('hides attendance when capability view is disabled', () => {
    const visible = canShowNavigationItem(attendanceItem, {
      role: ROLES.MANAGER,
      permissions: [...managerPermissions],
      libraryId: 'lib1',
      subscriptionFeatures: { attendance: true },
      roleCapabilities: {
        attendance: { view: false, checkin: false, checkout: false, export: false },
      },
      roleModules: { attendance: false } as never,
    });
    expect(visible).toBe(false);
  });

  it('hides attendance when subscription feature is off', () => {
    const visible = canShowNavigationItem(attendanceItem, {
      role: ROLES.MANAGER,
      permissions: [...managerPermissions],
      libraryId: 'lib1',
      subscriptionFeatures: { attendance: false },
      roleCapabilities: {
        attendance: { view: true, checkin: true, checkout: true, export: false },
      },
    });
    expect(visible).toBe(false);
  });

  it('preview mode can show capability-gated items without plan flags', () => {
    const visible = canShowNavigationItem(attendanceItem, {
      role: ROLES.MANAGER,
      permissions: [...managerPermissions],
      libraryId: 'lib1',
      assumeAllSubscriptionFeatures: true,
      roleCapabilities: {
        attendance: { view: true, checkin: true, checkout: true, export: false },
      },
    });
    expect(visible).toBe(true);
  });

  it('shows Public Booking for owner when permission, plan, and capability allow', () => {
    const visible = canShowNavigationItem(publicBookingItem, {
      role: ROLES.LIBRARY_OWNER,
      permissions: [PERMISSIONS.PUBLIC_PAGE_MANAGE],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: true },
      roleCapabilities: {
        public_booking: { view: true, manage: true, approve: true, convert: true },
      },
    });
    expect(visible).toBe(true);
  });

  it('hides Public Booking when subscription feature is off', () => {
    const visible = canShowNavigationItem(publicBookingItem, {
      role: ROLES.LIBRARY_OWNER,
      permissions: [PERMISSIONS.BOOKING_READ],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: false },
      roleCapabilities: {
        public_booking: { view: true, manage: true, approve: true, convert: true },
      },
    });
    expect(visible).toBe(false);
  });

  it('shows Public Booking for owner when public_booking effective feature is true', () => {
    const visible = canShowNavigationItem(publicBookingItem, {
      role: ROLES.LIBRARY_OWNER,
      permissions: [PERMISSIONS.BOOKING_READ],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: true },
    });
    expect(visible).toBe(true);
  });

  it('shows Public Booking for owner without booking permissions in JWT when feature is on', () => {
    const visible = canShowNavigationItem(publicBookingItem, {
      role: ROLES.LIBRARY_OWNER,
      permissions: [],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: true },
    });
    expect(visible).toBe(true);
  });

  it('shows Public Booking for owner when only Super Admin override enables the feature', () => {
    const visible = canShowNavigationItem(publicBookingItem, {
      role: ROLES.LIBRARY_OWNER,
      permissions: [],
      libraryId: 'lib1',
      subscriptionFeatures: {},
      enabledFeaturesOverride: ['public_booking'],
    });
    expect(visible).toBe(true);
  });

  it('hides Public Booking for manager when role capability view is disabled', () => {
    const visible = canShowNavigationItem(publicBookingItem, {
      role: ROLES.MANAGER,
      permissions: [PERMISSIONS.BOOKING_READ],
      libraryId: 'lib1',
      subscriptionFeatures: { public_booking: true },
      roleCapabilities: {
        public_booking: { view: false, manage: false, approve: false, convert: false },
      },
    });
    expect(visible).toBe(false);
  });

  it('does not show separate Bookings sidebar item', () => {
    expect(duplicateBookingsItem).toBeUndefined();
  });
});
