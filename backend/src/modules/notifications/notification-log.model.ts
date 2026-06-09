import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import type { NotificationLogAction } from './notifications.constants';
import { NOTIFICATION_LOG_ACTIONS } from './notifications.constants';

const MODEL_NAME = 'NotificationLog';

export interface INotificationLog {
  libraryId: Types.ObjectId | null;
  branchId: Types.ObjectId | null;
  notificationId: Types.ObjectId | null;
  action: NotificationLogAction | string;
  channel: string;
  notificationType: string;
  summary: string;
  recipientCount: number;
  createdBy: Types.ObjectId | null;
  metadata: Record<string, unknown>;
}

export interface INotificationLogDocument extends INotificationLog, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type INotificationLogModel = Model<INotificationLogDocument>;

const notificationLogSchema = new Schema<INotificationLogDocument, INotificationLogModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', default: null, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    notificationId: { type: Schema.Types.ObjectId, ref: 'Notification', default: null, index: true },
    action: { type: String, required: true, enum: NOTIFICATION_LOG_ACTIONS, index: true },
    channel: { type: String, required: true, trim: true, maxlength: 32 },
    notificationType: { type: String, required: true, trim: true, maxlength: 64, index: true },
    summary: { type: String, required: true, trim: true, maxlength: 500 },
    recipientCount: { type: Number, required: true, min: 0, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, versionKey: false },
);

notificationLogSchema.index({ libraryId: 1, createdAt: -1 });

export const NotificationLogModel: INotificationLogModel =
  (mongoose.models[MODEL_NAME] as INotificationLogModel) ||
  mongoose.model<INotificationLogDocument, INotificationLogModel>(MODEL_NAME, notificationLogSchema);
