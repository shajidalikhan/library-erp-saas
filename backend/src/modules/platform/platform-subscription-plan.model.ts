import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

const MODEL_NAME = 'PlatformSubscriptionPlan';

export interface IPlatformSubscriptionPlan {
  planKey: string;
  displayName: string;
  description?: string;
  perfectFor?: string;
  highlights?: string[];
  maxStudents: number;
  maxBranches: number;
  maxSeats: number;
  maxStaff: number;
  storageLimitMb: number;
  featureFlags: Record<string, boolean>;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  active: boolean;
  mostPopular: boolean;
  publicVisible: boolean;
  trialDays: number;
  sortOrder: number;
}

export interface IPlatformSubscriptionPlanDocument extends IPlatformSubscriptionPlan, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IPlatformSubscriptionPlanModel = Model<IPlatformSubscriptionPlanDocument>;

const planSchema = new Schema<IPlatformSubscriptionPlanDocument, IPlatformSubscriptionPlanModel>(
  {
    planKey: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    perfectFor: { type: String, default: '', trim: true, maxlength: 300 },
    highlights: { type: [String], default: [] },
    maxStudents: { type: Number, required: true, min: 0, default: 0 },
    maxBranches: { type: Number, required: true, min: 0, default: 0 },
    maxSeats: { type: Number, required: true, min: 0, default: 0 },
    maxStaff: { type: Number, required: true, min: 0, default: 0 },
    storageLimitMb: { type: Number, required: true, min: 0, default: 0 },
    featureFlags: { type: Schema.Types.Mixed, default: {} },
    monthlyPrice: { type: Number, required: true, min: 0, default: 0 },
    yearlyPrice: { type: Number, required: true, min: 0, default: 0 },
    currency: { type: String, default: 'INR', trim: true, uppercase: true, maxlength: 8 },
    active: { type: Boolean, default: true, index: true },
    mostPopular: { type: Boolean, default: false },
    publicVisible: { type: Boolean, default: true, index: true },
    trialDays: { type: Number, default: 14, min: 0, max: 90 },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

export const PlatformSubscriptionPlanModel: IPlatformSubscriptionPlanModel =
  (mongoose.models[MODEL_NAME] as IPlatformSubscriptionPlanModel) ||
  mongoose.model<IPlatformSubscriptionPlanDocument, IPlatformSubscriptionPlanModel>(
    MODEL_NAME,
    planSchema,
  );
