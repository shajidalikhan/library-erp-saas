import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import {
  FEE_PLAN_TYPES,
  MINIMUM_START_AMOUNT_TYPES,
  type FeePlanType,
  type MinimumStartAmountType,
} from './fee-plan.constants';

const MODEL_NAME = 'FeePlan';

export interface IFeePlan {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  name: string;
  type: FeePlanType;
  amount: number;
  durationDays: number;
  billingDurationMonths?: number | null;
  shiftId: Types.ObjectId | null;
  allowManualPriceOverride: boolean;
  allowPartialStart: boolean;
  minimumStartAmountType: MinimumStartAmountType | null;
  minimumStartAmount: number | null;
  partialDueDays: number | null;
  downgradeIfUnpaid: boolean;
  downgradeDurationDays: number;
  offerLabel?: string | null;
  description?: string;
  active: boolean;
}

export interface IFeePlanDocument extends IFeePlan, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IFeePlanModel = Model<IFeePlanDocument>;

const feePlanSchema = new Schema<IFeePlanDocument, IFeePlanModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    type: {
      type: String,
      enum: FEE_PLAN_TYPES,
      default: 'MEMBERSHIP',
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    durationDays: { type: Number, required: true, min: 1 },
    billingDurationMonths: { type: Number, min: 1, default: null },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', default: null, index: true },
    allowManualPriceOverride: { type: Boolean, default: false },
    allowPartialStart: { type: Boolean, default: false },
    minimumStartAmountType: {
      type: String,
      enum: MINIMUM_START_AMOUNT_TYPES,
      default: null,
    },
    minimumStartAmount: { type: Number, min: 0, default: null },
    partialDueDays: { type: Number, min: 1, default: null },
    downgradeIfUnpaid: { type: Boolean, default: true },
    downgradeDurationDays: { type: Number, min: 1, default: 30 },
    offerLabel: { type: String, trim: true, maxlength: 160, default: null },
    description: { type: String, trim: true, maxlength: 2000 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

feePlanSchema.index({ libraryId: 1, branchId: 1, name: 1 });

export const FeePlanModel: IFeePlanModel =
  (mongoose.models[MODEL_NAME] as IFeePlanModel) ||
  mongoose.model<IFeePlanDocument, IFeePlanModel>(MODEL_NAME, feePlanSchema);
