/**
 * Platform / SaaS control module constants.
 */

export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'USER_CREATE',
  'USER_UPDATE',
  'STUDENT_CREATED',
  'STUDENT_UPDATED',
  'SEAT_ASSIGNED',
  'SEAT_UNASSIGNED',
  'STUDENT_SEAT_RELEASED',
  'ATTENDANCE_CHECK_IN',
  'ATTENDANCE_CHECK_OUT',
  'INVOICE_CREATED',
  'PAYMENT_COLLECTED',
  'BRANCH_CREATED',
  'TENANT_SUSPEND',
  'TENANT_ACTIVATE',
  'TENANT_UPDATE',
  'SEAT_DELETE',
  'PAYMENT_COLLECT',
  'INVOICE_UPDATE',
  'NOTIFICATION_SEND',
  'PLATFORM_ANNOUNCEMENT',
  'SUBSCRIPTION_PLAN_UPDATE',
  'SUBSCRIPTION_PLAN_CREATED',
  'SUBSCRIPTION_PLAN_UPDATED',
  'SUBSCRIPTION_PLAN_DEACTIVATED',
  'PLATFORM_SETTINGS_UPDATE',
  'PLAN_LIMIT_BLOCKED',
  'LIBRARY_FEATURE_OVERRIDE',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const ENTITY_TYPES = [
  'USER',
  'LIBRARY',
  'BRANCH',
  'STUDENT',
  'SEAT',
  'INVOICE',
  'PAYMENT',
  'NOTIFICATION',
  'SUBSCRIPTION_PLAN',
  'PLATFORM_SETTING',
  'OTHER',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/** Future impersonation: signed short-lived token, actor preserved in audit only. */
export const IMPERSONATION_HEADER = 'X-Impersonation-Context' as const;
