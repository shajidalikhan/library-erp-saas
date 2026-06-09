import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { DOWNGRADE_STATUS, MEMBERSHIP_STATUS, MEMBERSHIP_TYPE } from './membership.constants';

const MODEL_NAME = 'Membership';

export interface IMembership {
  studentId: Types.ObjectId;
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  shiftId: Types.ObjectId | null;
  seatId: Types.ObjectId | null;
  membershipType: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  status: string;
  feePlanId: Types.ObjectId | null;
  invoiceId: Types.ObjectId | null;
  paymentId: Types.ObjectId | null;
  selectedPlanDurationDays?: number | null;
  effectiveDurationDays?: number | null;
  originalEndDate?: Date | null;
  effectiveEndDate?: Date | null;
  downgradeDueDate?: Date | null;
  downgradeStatus?: string;
  downgradeReason?: string | null;
  fullPaymentRequiredAmount?: number | null;
  paidBeforeDowngrade?: number | null;
  pendingUpgradeAmount?: number | null;
}

export interface IMembershipDocument extends IMembership, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IMembershipModel = Model<IMembershipDocument>;

const membershipSchema = new Schema<IMembershipDocument, IMembershipModel>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', default: null, index: true },
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat', default: null, index: true },
    membershipType: {
      type: String,
      enum: Object.values(MEMBERSHIP_TYPE),
      required: true,
      index: true,
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    durationDays: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: Object.values(MEMBERSHIP_STATUS),
      default: MEMBERSHIP_STATUS.UPCOMING,
      index: true,
    },
    feePlanId: { type: Schema.Types.ObjectId, ref: 'FeePlan', default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    paymentId: { type: Schema.Types.ObjectId, ref: 'PaymentRecord', default: null },
    selectedPlanDurationDays: { type: Number, min: 1, default: null },
    effectiveDurationDays: { type: Number, min: 1, default: null },
    originalEndDate: { type: Date, default: null },
    effectiveEndDate: { type: Date, default: null },
    downgradeDueDate: { type: Date, default: null, index: true },
    downgradeStatus: {
      type: String,
      enum: Object.values(DOWNGRADE_STATUS),
      default: DOWNGRADE_STATUS.NONE,
      index: true,
    },
    downgradeReason: { type: String, trim: true, maxlength: 500, default: null },
    fullPaymentRequiredAmount: { type: Number, min: 0, default: null },
    paidBeforeDowngrade: { type: Number, min: 0, default: null },
    pendingUpgradeAmount: { type: Number, min: 0, default: null },
  },
  { timestamps: true, versionKey: false },
);

membershipSchema.index({ libraryId: 1, studentId: 1, status: 1 });
membershipSchema.index({ libraryId: 1, branchId: 1, endDate: 1 });

export const MembershipModel: IMembershipModel =
  (mongoose.models[MODEL_NAME] as IMembershipModel) ||
  mongoose.model<IMembershipDocument, IMembershipModel>(MODEL_NAME, membershipSchema);
