/**
 * Mirrors `backend/src/constants/permissions.constants.ts`.
 *
 * KEEP IN SYNC. The backend remains the source of truth; this file exists
 * only so that the UI can statically reference permission strings without
 * sprinkling magic strings across components.
 */
export const PERMISSIONS = {
  USER_READ: 'user.read',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  USER_INVITE: 'user.invite',

  STAFF_CREATE: 'staff.create',
  STAFF_READ: 'staff.read',
  STAFF_UPDATE: 'staff.update',
  STAFF_DELETE: 'staff.delete',

  ROLE_READ: 'role.read',
  ROLE_MANAGE: 'role.manage',

  LIBRARY_READ: 'library.read',
  LIBRARY_CREATE: 'library.create',
  LIBRARY_UPDATE: 'library.update',
  LIBRARY_DELETE: 'library.delete',

  BRANCH_READ: 'branch.read',
  BRANCH_CREATE: 'branch.create',
  BRANCH_UPDATE: 'branch.update',
  BRANCH_DELETE: 'branch.delete',

  STUDENT_READ: 'student.read',
  STUDENT_READ_BASIC: 'student.read.basic',
  STUDENT_CREATE: 'student.create',
  STUDENT_UPDATE: 'student.update',
  STUDENT_DELETE: 'student.delete',
  STUDENT_TRANSFER: 'student.transfer',
  STUDENT_ASSIGN_SEAT: 'student.assignSeat',

  SEAT_READ: 'seat.read',
  SEAT_OCCUPANCY_READ: 'seat.occupancy.read',
  SEAT_CREATE: 'seat.create',
  SEAT_UPDATE: 'seat.update',
  SEAT_DELETE: 'seat.delete',
  SEAT_ASSIGN: 'seat.assign',
  SEAT_UNASSIGN: 'seat.unassign',
  SEAT_BULK_CREATE: 'seat.bulkCreate',

  SHIFT_CREATE: 'shift.create',
  SHIFT_READ: 'shift.read',
  SHIFT_UPDATE: 'shift.update',
  SHIFT_DELETE: 'shift.delete',

  MEMBERSHIP_CREATE: 'membership.create',
  MEMBERSHIP_READ: 'membership.read',
  MEMBERSHIP_UPDATE: 'membership.update',
  MEMBERSHIP_RENEW: 'membership.renew',

  STUDENT_FIELD_MANAGE: 'studentField.manage',
  ID_CARD_GENERATE: 'idCard.generate',

  ATTENDANCE_READ: 'attendance.read',
  ATTENDANCE_CREATE: 'attendance.create',
  ATTENDANCE_UPDATE: 'attendance.update',
  ATTENDANCE_CHECK_IN: 'attendance.checkIn',
  ATTENDANCE_CHECK_OUT: 'attendance.checkOut',
  ATTENDANCE_SUMMARY: 'attendance.summary',

  PAYMENT_READ: 'payment.read',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_UPDATE: 'payment.update',
  PAYMENT_DELETE: 'payment.delete',
  PAYMENT_REFUND: 'payment.refund',
  PAYMENT_SUMMARY: 'payment.summary',

  FEE_PLAN_CREATE: 'feePlan.create',
  FEE_PLAN_READ: 'feePlan.read',
  FEE_PLAN_UPDATE: 'feePlan.update',
  FEE_PLAN_DELETE: 'feePlan.delete',

  BOOKING_READ: 'booking.read',
  BOOKING_CREATE: 'booking.create',
  BOOKING_UPDATE: 'booking.update',
  BOOKING_MANAGE: 'booking.manage',
  BOOKING_CONVERT: 'booking.convert',
  PUBLIC_PAGE_READ: 'publicPage.read',
  PUBLIC_PAGE_MANAGE: 'publicPage.manage',

  REPORT_VIEW: 'report.view',
  ANALYTICS_VIEW: 'analytics.view',

  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_SEND: 'notification.send',
  NOTIFICATION_MANAGE: 'notification.manage',
  NOTIFICATION_TEMPLATE_MANAGE: 'notification.template.manage',

  PLATFORM_MANAGE: 'platform.manage',
  AUDIT_READ: 'audit.read',
  SUBSCRIPTION_MANAGE: 'subscription.manage',
  IMPERSONATION_MANAGE: 'impersonation.manage',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as PermissionName[];
const PERMISSION_BY_LOWER = new Map(ALL_PERMISSIONS.map((name) => [name.toLowerCase(), name]));

/** Map API/JWT permission strings (often lowercased) to catalog keys. */
export function canonicalPermissionName(stored: string): PermissionName {
  return (PERMISSION_BY_LOWER.get(stored.toLowerCase()) ?? stored) as PermissionName;
}

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  LIBRARY_OWNER: 'LIBRARY_OWNER',
  MANAGER: 'MANAGER',
  RECEPTIONIST: 'RECEPTIONIST',
  ACCOUNTANT: 'ACCOUNTANT',
  SECURITY: 'SECURITY',
  STUDENT: 'STUDENT',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];
