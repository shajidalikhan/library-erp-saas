import type { AuditAction } from '@modules/platform/platform.constants';

export const ACTIVITY_EVENT_TYPES = [
  'student_created',
  'student_updated',
  'seat_assigned',
  'seat_unassigned',
  'check_in',
  'check_out',
  'invoice_created',
  'payment_collected',
  'notification_sent',
  'branch_created',
  'user_created',
  'tenant_updated',
  'tenant_suspended',
  'tenant_activated',
  'login',
  'other',
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const ACTION_TO_ACTIVITY_TYPE: Record<string, ActivityEventType> = {
  LOGIN: 'login',
  USER_CREATE: 'user_created',
  USER_UPDATE: 'user_created',
  STUDENT_CREATED: 'student_created',
  STUDENT_UPDATED: 'student_updated',
  SEAT_ASSIGNED: 'seat_assigned',
  SEAT_UNASSIGNED: 'seat_unassigned',
  STUDENT_SEAT_RELEASED: 'seat_unassigned',
  ATTENDANCE_CHECK_IN: 'check_in',
  ATTENDANCE_CHECK_OUT: 'check_out',
  INVOICE_CREATED: 'invoice_created',
  PAYMENT_COLLECTED: 'payment_collected',
  PAYMENT_COLLECT: 'payment_collected',
  NOTIFICATION_SEND: 'notification_sent',
  PLATFORM_ANNOUNCEMENT: 'notification_sent',
  BRANCH_CREATED: 'branch_created',
  TENANT_UPDATE: 'tenant_updated',
  TENANT_SUSPEND: 'tenant_suspended',
  TENANT_ACTIVATE: 'tenant_activated',
};

export const ACTIVITY_TITLES: Partial<Record<ActivityEventType, string>> = {
  student_created: 'Student created',
  student_updated: 'Student updated',
  seat_assigned: 'Seat assigned',
  seat_unassigned: 'Seat unassigned',
  check_in: 'Check-in',
  check_out: 'Check-out',
  invoice_created: 'Invoice created',
  payment_collected: 'Payment collected',
  notification_sent: 'Notification sent',
  branch_created: 'Branch created',
  user_created: 'User created',
  tenant_updated: 'Tenant updated',
  tenant_suspended: 'Tenant suspended',
  tenant_activated: 'Tenant activated',
  login: 'Signed in',
  other: 'Activity',
};

export function mapAuditActionToType(action: string): ActivityEventType {
  return ACTION_TO_ACTIVITY_TYPE[action as AuditAction] ?? 'other';
}
