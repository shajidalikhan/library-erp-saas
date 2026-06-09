import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { NOTIFICATION_TYPES } from './notifications.constants';

const MODEL_NAME = 'NotificationTemplate';

export interface INotificationTemplate {
  libraryId: Types.ObjectId | null;
  branchId: Types.ObjectId | null;
  name: string;
  type: string;
  subject: string;
  body: string;
  variables: string[];
  active: boolean;
}

export interface INotificationTemplateDocument extends INotificationTemplate, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type INotificationTemplateModel = Model<INotificationTemplateDocument>;

const notificationTemplateSchema = new Schema<INotificationTemplateDocument, INotificationTemplateModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', default: null, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, required: true, enum: NOTIFICATION_TYPES, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    variables: [{ type: String, trim: true, maxlength: 64 }],
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

notificationTemplateSchema.index({ libraryId: 1, name: 1 }, { unique: true, partialFilterExpression: { libraryId: { $type: 'objectId' } } });
notificationTemplateSchema.index({ libraryId: 1, active: 1 });

export const NotificationTemplateModel: INotificationTemplateModel =
  (mongoose.models[MODEL_NAME] as INotificationTemplateModel) ||
  mongoose.model<INotificationTemplateDocument, INotificationTemplateModel>(MODEL_NAME, notificationTemplateSchema);
