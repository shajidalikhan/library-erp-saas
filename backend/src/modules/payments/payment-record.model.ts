import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { PAYMENT_METHODS, PAYMENT_RECORD_STATUSES } from './payment.constants';

const MODEL_NAME = 'Payment';

export interface IPaymentRecord {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  amount: number;
  method: string;
  transactionId?: string;
  receiptNumber: string;
  receivedBy: Types.ObjectId;
  paidAt: Date;
  notes?: string;
  status: string;
  refundedAmount: number;
}

export interface IPaymentDocument extends IPaymentRecord, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IPaymentModel = Model<IPaymentDocument>;

const paymentSchema = new Schema<IPaymentDocument, IPaymentModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: Object.values(PAYMENT_METHODS), required: true },
    transactionId: { type: String, trim: true, maxlength: 200 },
    receiptNumber: { type: String, required: true, trim: true, maxlength: 64 },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    paidAt: { type: Date, required: true, index: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(PAYMENT_RECORD_STATUSES),
      default: 'ACTIVE',
      index: true,
    },
    refundedAmount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, versionKey: false },
);

paymentSchema.index({ libraryId: 1, receiptNumber: 1 }, { unique: true });
paymentSchema.index({ libraryId: 1, branchId: 1, invoiceId: 1 });
paymentSchema.index({ libraryId: 1, branchId: 1, studentId: 1, paidAt: -1 });
paymentSchema.index({ libraryId: 1, status: 1, paidAt: -1 });

export const PaymentRecordModel: IPaymentModel =
  (mongoose.models[MODEL_NAME] as IPaymentModel) ||
  mongoose.model<IPaymentDocument, IPaymentModel>(MODEL_NAME, paymentSchema);
