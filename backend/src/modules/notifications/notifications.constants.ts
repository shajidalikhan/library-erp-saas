export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_TYPES = [
  'PAYMENT_DUE',
  'PAYMENT_OVERDUE',
  'MEMBERSHIP_EXPIRY',
  'SEAT_ASSIGNED',
  'ATTENDANCE_ALERT',
  'ANNOUNCEMENT',
  'SYSTEM',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_STATUS = ['PENDING', 'SENT', 'FAILED'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUS)[number];

/** How the send API addressed recipients (stored for audit). */
export const RECIPIENT_TARGET_MODES = [
  'USER',
  'ROLE',
  'BRANCH',
  'LIBRARY',
  'STUDENTS_WITH_DUES',
  /** All active users platform-wide (SUPER_ADMIN only). */
  'PLATFORM',
] as const;
export type RecipientTargetMode = (typeof RECIPIENT_TARGET_MODES)[number];

export const NOTIFICATION_LOG_ACTIONS = ['SEND', 'BULK_SEND', 'CRON'] as const;
export type NotificationLogAction = (typeof NOTIFICATION_LOG_ACTIONS)[number];

/** Role names allowed in send target (API string). */
export const SEND_TARGET_ROLE_NAMES = [
  'SUPER_ADMIN',
  'LIBRARY_OWNER',
  'MANAGER',
  'RECEPTIONIST',
  'ACCOUNTANT',
  'SECURITY',
  'STUDENT',
] as const;
export type SendTargetRoleName = (typeof SEND_TARGET_ROLE_NAMES)[number];
