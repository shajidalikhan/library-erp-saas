import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { SUBSCRIPTION_EVENT_TYPE } from './library-subscription.constants';

const MODEL_NAME = 'SubscriptionEvent';

export interface ISubscriptionEvent {
  libraryId: Types.ObjectId;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  actorUserId: Types.ObjectId | null;
}

export interface ISubscriptionEventDocument extends ISubscriptionEvent, Document {
  _id: Types.ObjectId;
  createdAt: Date;
}

export type ISubscriptionEventModel = Model<ISubscriptionEventDocument>;

const subscriptionEventSchema = new Schema<ISubscriptionEventDocument, ISubscriptionEventModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    type: {
      type: String,
      enum: Object.values(SUBSCRIPTION_EVENT_TYPE),
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

subscriptionEventSchema.index({ libraryId: 1, createdAt: -1 });

export const SubscriptionEventModel: ISubscriptionEventModel =
  (mongoose.models[MODEL_NAME] as ISubscriptionEventModel) ||
  mongoose.model<ISubscriptionEventDocument, ISubscriptionEventModel>(
    MODEL_NAME,
    subscriptionEventSchema,
  );
