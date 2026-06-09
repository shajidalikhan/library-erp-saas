import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { INVOICE_STATUSES } from './payment.constants';

const MODEL_NAME = 'Invoice';

export interface IInvoice {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  seatId: Types.ObjectId | null;
  feePlanId: Types.ObjectId | null;
  invoiceNumber: string;
  amount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  /** Running total of completed refunds against this invoice (derived, maintained by service). */
  refundTotal: number;
  dueAmount: number;
  status: string;
  dueDate: Date;
  notes?: string;
  membershipPeriodStart?: Date | null;
  membershipPeriodEnd?: Date | null;
  membershipId?: Types.ObjectId | null;
  downgradeDueDate?: Date | null;
  downgradeIfUnpaid?: boolean;
  selectedDurationDays?: number | null;
  downgradeDurationDays?: number | null;
  partialMinimumAmount?: number | null;
  adjustmentNotes?: string[];
  currency: string;
}

export interface IInvoiceDocument extends IInvoice, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IInvoiceModel = Model<IInvoiceDocument>;

const invoiceSchema = new Schema<IInvoiceDocument, IInvoiceModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat', default: null, index: true },
    feePlanId: { type: Schema.Types.ObjectId, ref: 'FeePlan', default: null, index: true },
    invoiceNumber: { type: String, required: true, trim: true, maxlength: 64 },
    amount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    refundTotal: { type: Number, required: true, min: 0, default: 0 },
    dueAmount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: Object.values(INVOICE_STATUSES),
      default: 'UNPAID',
      index: true,
    },
    dueDate: { type: Date, required: true, index: true },
    notes: { type: String, trim: true, maxlength: 5000 },
    membershipPeriodStart: { type: Date, default: null },
    membershipPeriodEnd: { type: Date, default: null },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', default: null, index: true },
    downgradeDueDate: { type: Date, default: null, index: true },
    downgradeIfUnpaid: { type: Boolean, default: false },
    selectedDurationDays: { type: Number, min: 1, default: null },
    downgradeDurationDays: { type: Number, min: 1, default: null },
    partialMinimumAmount: { type: Number, min: 0, default: null },
    adjustmentNotes: { type: [String], default: [] },
    currency: { type: String, default: 'INR', trim: true, maxlength: 8 },
  },
  { timestamps: true, versionKey: false },
);

invoiceSchema.index({ libraryId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ libraryId: 1, branchId: 1, studentId: 1 });
invoiceSchema.index({ libraryId: 1, branchId: 1, status: 1, dueDate: 1 });

export const InvoiceModel: IInvoiceModel =
  (mongoose.models[MODEL_NAME] as IInvoiceModel) ||
  mongoose.model<IInvoiceDocument, IInvoiceModel>(MODEL_NAME, invoiceSchema);
