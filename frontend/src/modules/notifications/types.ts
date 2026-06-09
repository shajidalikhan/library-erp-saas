import type { PaginationMeta } from '@/types/api';

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

export const NOTIFICATION_CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const SEND_TARGET_MODES = [
  'USER',
  'ROLE',
  'BRANCH',
  'LIBRARY',
  'STUDENTS_WITH_DUES',
  'PLATFORM',
] as const;
export type SendTargetMode = (typeof SEND_TARGET_MODES)[number];

export interface NotificationItem {
  _id: string;
  libraryId: string | null;
  branchId: string | null;
  recipientUserId: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  status: string;
  readAt: string | null;
  sentAt: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedNotifications {
  items: NotificationItem[];
  meta: { pagination: PaginationMeta };
}

export interface NotificationTemplateItem {
  _id: string;
  libraryId: string | null;
  branchId: string | null;
  name: string;
  type: string;
  subject: string;
  body: string;
  variables: string[];
  active: boolean;
  createdAt: string;
}

export interface NotificationLogItem {
  _id: string;
  libraryId: string | null;
  branchId: string | null;
  action: string;
  channel: string;
  notificationType: string;
  summary: string;
  recipientCount: number;
  createdBy: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationRecipientRow {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: string;
  branchName: string | null;
  libraryName: string | null;
}

export interface NotificationLogDetail {
  id: string;
  action: string;
  channel: string;
  createdAt: string;
  createdBy: { id: string; fullName: string; email: string } | null;
  title: string;
  message: string | null;
  type: string;
  audience: unknown;
  includeSelf: boolean;
  recipients: Array<{
    userId: string;
    fullName: string;
    email: string;
    role: string;
    branchName: string | null;
    libraryName: string | null;
  }>;
  recipientNames: string[];
  recipientCount: number;
  statusBreakdown: { SENT: number; FAILED: number; PENDING: number };
  legacy?: true;
}

export interface SendTargetPayload {
  mode: SendTargetMode;
  userId?: string;
  role?: string;
  branchId?: string;
}

export interface SendNotificationPayload {
  libraryId?: string;
  branchId?: string;
  title: string;
  message: string;
  type: NotificationType;
  channel?: NotificationChannel;
  templateId?: string;
  templateVariables?: Record<string, string>;
  target: SendTargetPayload;
  includeSelf?: boolean;
  metadata?: Record<string, unknown>;
}
