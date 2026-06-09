import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import {
  SUBSCRIPTION_RECORD_BILLING_CYCLE,
  SUBSCRIPTION_RECORD_STATUS,
} from './library-subscription.constants';

const MODEL_NAME = 'LibrarySubscription';

export interface ILibrarySubscription {
  libraryId: Types.ObjectId;
  planId: Types.ObjectId | null;
  planCode: string;
  planName: string;
  billingCycle: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  currentInvoiceId: Types.ObjectId | null;
  lastPaymentId: Types.ObjectId | null;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  autoRenew: boolean;
  manuallyAdjusted: boolean;
  adjustmentReason: string | null;
  upcomingPlanId: Types.ObjectId | null;
  upcomingPlanCode: string | null;
  upcomingPlanName: string | null;
  upcomingBillingCycle: string | null;
  upcomingStartDate: Date | null;
  upcomingEndDate: Date | null;
  updatedBy: Types.ObjectId | null;
}

export interface ILibrarySubscriptionDocument extends ILibrarySubscription, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ILibrarySubscriptionModel = Model<ILibrarySubscriptionDocument>;

const librarySubscriptionSchema = new Schema<ILibrarySubscriptionDocument, ILibrarySubscriptionModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, unique: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'PlatformSubscriptionPlan', default: null },
    planCode: { type: String, required: true, trim: true, maxlength: 40 },
    planName: { type: String, required: true, trim: true, maxlength: 120 },
    billingCycle: {
      type: String,
      enum: Object.values(SUBSCRIPTION_RECORD_BILLING_CYCLE),
      default: SUBSCRIPTION_RECORD_BILLING_CYCLE.MONTHLY,
    },
    status: {
      type: String,
      enum: Object.values(SUBSCRIPTION_RECORD_STATUS),
      default: SUBSCRIPTION_RECORD_STATUS.TRIALING,
      index: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    graceEndsAt: { type: Date, default: null },
    currentInvoiceId: { type: Schema.Types.ObjectId, ref: 'PlatformSubscriptionInvoice', default: null },
    lastPaymentId: { type: Schema.Types.ObjectId, default: null },
    amount: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueAmount: { type: Number, default: 0, min: 0 },
    autoRenew: { type: Boolean, default: true },
    manuallyAdjusted: { type: Boolean, default: false },
    adjustmentReason: { type: String, trim: true, maxlength: 2000, default: null },
    upcomingPlanId: { type: Schema.Types.ObjectId, ref: 'PlatformSubscriptionPlan', default: null },
    upcomingPlanCode: { type: String, trim: true, maxlength: 40, default: null },
    upcomingPlanName: { type: String, trim: true, maxlength: 120, default: null },
    upcomingBillingCycle: { type: String, trim: true, maxlength: 20, default: null },
    upcomingStartDate: { type: Date, default: null },
    upcomingEndDate: { type: Date, default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export const LibrarySubscriptionModel: ILibrarySubscriptionModel =
  (mongoose.models[MODEL_NAME] as ILibrarySubscriptionModel) ||
  mongoose.model<ILibrarySubscriptionDocument, ILibrarySubscriptionModel>(
    MODEL_NAME,
    librarySubscriptionSchema,
  );
