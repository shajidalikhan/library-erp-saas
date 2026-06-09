import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { REFUND_STATUSES } from './payment.constants';

const MODEL_NAME = 'Refund';

export interface IRefund {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  paymentId: Types.ObjectId;
  amount: number;
  reason?: string;
  refundedBy: Types.ObjectId;
  refundedAt: Date;
  notes?: string;
  status: string;
}

export interface IRefundDocument extends IRefund, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IRefundModel = Model<IRefundDocument>;

const refundSchema = new Schema<IRefundDocument, IRefundModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, maxlength: 500 },
    refundedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    refundedAt: { type: Date, required: true, index: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(REFUND_STATUSES),
      default: 'COMPLETED',
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

refundSchema.index({ libraryId: 1, branchId: 1, paymentId: 1 });

export const RefundModel: IRefundModel =
  (mongoose.models[MODEL_NAME] as IRefundModel) ||
  mongoose.model<IRefundDocument, IRefundModel>(MODEL_NAME, refundSchema);
