import { PERMISSIONS } from '@/constants/permissions';
import { ROLE_CAPABILITY_MODULES } from '@/lib/role-capabilities';
import type { RoleCapabilityModule } from '@/types/auth';

/** Canonical module keys — keep aligned with backend `ROLE_CAPABILITY_MODULES`. */
export const MODULE_KEYS = ROLE_CAPABILITY_MODULES;

export const MODULE_ACTIONS: Record<RoleCapabilityModule, readonly string[]> = {
  students: ['view', 'create', 'edit', 'delete', 'export', 'transfer', 'assign_seat'],
  attendance: ['view', 'checkin', 'checkout', 'export'],
  seats: ['view', 'create', 'edit', 'delete', 'assign', 'bulk_create'],
  shifts: ['view', 'create', 'edit', 'delete'],
  payments: ['view', 'collect', 'refund', 'export'],
  invoices: ['view', 'create', 'export'],
  dues: ['view', 'export'],
  reports: ['view', 'export'],
  analytics: ['view'],
  notifications: ['view', 'send', 'broadcast', 'template_manage'],
  settings: ['view', 'edit'],
  public_booking: ['view', 'manage', 'approve', 'convert'],
};

export const MODULE_SUBSCRIPTION_FEATURE: Partial<Record<RoleCapabilityModule, string>> = {
  seats: 'seat_management',
  shifts: 'shift_management',
  attendance: 'attendance',
  payments: 'payments',
  invoices: 'invoices',
  dues: 'dues',
  reports: 'reports',
  analytics: 'analytics',
  notifications: 'notifications',
  public_booking: 'public_booking',
};

export const PERMISSION_CAPABILITY_MAP: Record<
  string,
  { module: RoleCapabilityModule; action: string }
> = {
  [PERMISSIONS.STUDENT_READ]: { module: 'students', action: 'view' },
  [PERMISSIONS.STUDENT_READ_BASIC]: { module: 'students', action: 'view' },
  [PERMISSIONS.STUDENT_CREATE]: { module: 'students', action: 'create' },
  [PERMISSIONS.STUDENT_UPDATE]: { module: 'students', action: 'edit' },
  [PERMISSIONS.STUDENT_DELETE]: { module: 'students', action: 'delete' },
  [PERMISSIONS.STUDENT_TRANSFER]: { module: 'students', action: 'transfer' },
  [PERMISSIONS.STUDENT_ASSIGN_SEAT]: { module: 'students', action: 'assign_seat' },
  [PERMISSIONS.ATTENDANCE_READ]: { module: 'attendance', action: 'view' },
  [PERMISSIONS.ATTENDANCE_CREATE]: { module: 'attendance', action: 'checkin' },
  [PERMISSIONS.ATTENDANCE_CHECK_IN]: { module: 'attendance', action: 'checkin' },
  [PERMISSIONS.ATTENDANCE_CHECK_OUT]: { module: 'attendance', action: 'checkout' },
  [PERMISSIONS.SEAT_READ]: { module: 'seats', action: 'view' },
  [PERMISSIONS.SEAT_CREATE]: { module: 'seats', action: 'create' },
  [PERMISSIONS.SEAT_OCCUPANCY_READ]: { module: 'seats', action: 'view' },
  [PERMISSIONS.SEAT_ASSIGN]: { module: 'seats', action: 'assign' },
  [PERMISSIONS.SEAT_UPDATE]: { module: 'seats', action: 'edit' },
  [PERMISSIONS.SEAT_DELETE]: { module: 'seats', action: 'delete' },
  [PERMISSIONS.SHIFT_CREATE]: { module: 'shifts', action: 'create' },
  [PERMISSIONS.SHIFT_UPDATE]: { module: 'shifts', action: 'edit' },
  [PERMISSIONS.SHIFT_DELETE]: { module: 'shifts', action: 'delete' },
  [PERMISSIONS.ATTENDANCE_UPDATE]: { module: 'attendance', action: 'checkout' },
  [PERMISSIONS.FEE_PLAN_READ]: { module: 'invoices', action: 'view' },
  [PERMISSIONS.SHIFT_READ]: { module: 'shifts', action: 'view' },
  [PERMISSIONS.PAYMENT_READ]: { module: 'payments', action: 'view' },
  [PERMISSIONS.PAYMENT_CREATE]: { module: 'payments', action: 'collect' },
  [PERMISSIONS.PAYMENT_REFUND]: { module: 'payments', action: 'refund' },
  [PERMISSIONS.REPORT_VIEW]: { module: 'reports', action: 'view' },
  [PERMISSIONS.ANALYTICS_VIEW]: { module: 'analytics', action: 'view' },
  [PERMISSIONS.NOTIFICATION_READ]: { module: 'notifications', action: 'view' },
  [PERMISSIONS.NOTIFICATION_SEND]: { module: 'notifications', action: 'send' },
  [PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE]: {
    module: 'notifications',
    action: 'template_manage',
  },
  [PERMISSIONS.BOOKING_READ]: { module: 'public_booking', action: 'view' },
  [PERMISSIONS.BOOKING_CREATE]: { module: 'public_booking', action: 'manage' },
  [PERMISSIONS.BOOKING_UPDATE]: { module: 'public_booking', action: 'approve' },
  [PERMISSIONS.BOOKING_MANAGE]: { module: 'public_booking', action: 'manage' },
  [PERMISSIONS.BOOKING_CONVERT]: { module: 'public_booking', action: 'convert' },
  [PERMISSIONS.PUBLIC_PAGE_READ]: { module: 'public_booking', action: 'view' },
  [PERMISSIONS.PUBLIC_PAGE_MANAGE]: { module: 'public_booking', action: 'manage' },
};
