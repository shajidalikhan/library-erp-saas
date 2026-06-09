import type { NotificationChannel } from '../notifications.constants';
import type { NotificationStatus } from '../notifications.constants';
import type { NotificationType } from '../notifications.constants';
import { NotificationModel } from '../notification.model';
import type { Types } from 'mongoose';

export type InAppNotificationInput = {
  libraryId: Types.ObjectId | null;
  branchId: Types.ObjectId | null;
  recipientUserId: Types.ObjectId;
  recipientRole: string | null;
  recipientType: string;
  title: string;
  message: string;
  type: NotificationType | string;
  channel: NotificationChannel | string;
  status: NotificationStatus | string;
  sentAt: Date;
  metadata: Record<string, unknown>;
  createdBy: Types.ObjectId | null;
};

export async function insertInAppNotifications(docs: InAppNotificationInput[]): Promise<void> {
  if (docs.length === 0) return;
  await NotificationModel.insertMany(docs, { ordered: false });
}
