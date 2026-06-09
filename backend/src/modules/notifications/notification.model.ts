import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import type { NotificationChannel } from './notifications.constants';
import type { NotificationStatus } from './notifications.constants';
import type { NotificationType } from './notifications.constants';
import type { RecipientTargetMode } from './notifications.constants';
import { NOTIFICATION_CHANNELS, NOTIFICATION_STATUS, NOTIFICATION_TYPES } from './notifications.constants';

const MODEL_NAME = 'Notification';

export interface INotification {
  libraryId: Types.ObjectId | null;
  branchId: Types.ObjectId | null;
  recipientUserId: Types.ObjectId;
  recipientRole: string | null;
  recipientType: RecipientTargetMode | string;
  title: string;
  message: string;
  type: NotificationType | string;
  channel: NotificationChannel | string;
  status: NotificationStatus | string;
  readAt: Date | null;
  sentAt: Date;
  metadata: Record<string, unknown>;
  createdBy: Types.ObjectId | null;
}

export interface INotificationDocument extends INotification, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type INotificationModel = Model<INotificationDocument>;

const notificationSchema = new Schema<INotificationDocument, INotificationModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', default: null, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipientRole: { type: String, default: null, trim: true, maxlength: 32, index: true },
    recipientType: { type: String, required: true, trim: true, maxlength: 32, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 8000 },
    type: {
      type: String,
      required: true,
      enum: NOTIFICATION_TYPES,
      index: true,
    },
    channel: {
      type: String,
      required: true,
      enum: NOTIFICATION_CHANNELS,
      default: 'IN_APP',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: NOTIFICATION_STATUS,
      default: 'SENT',
      index: true,
    },
    readAt: { type: Date, default: null, index: true },
    sentAt: { type: Date, required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index({ recipientUserId: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ libraryId: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, type: 1, createdAt: -1 });

export const NotificationModel: INotificationModel =
  (mongoose.models[MODEL_NAME] as INotificationModel) ||
  mongoose.model<INotificationDocument, INotificationModel>(MODEL_NAME, notificationSchema);
