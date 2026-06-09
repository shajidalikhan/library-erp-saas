import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import type { BillingCycle } from './subscription-billing.constants';
import { PLATFORM_SUBSCRIPTION_INVOICE_STATUS } from './subscription-billing.constants';

const MODEL_NAME = 'PlatformSubscriptionInvoice';

export interface IPlatformSubscriptionInvoice {
  libraryId: Types.ObjectId;
  planId: Types.ObjectId;
  planCode: string;
  planName: string;
  billingCycle: BillingCycle;
  invoiceNumber: string;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  issueDate: Date;
  dueDate: Date;
  subscriptionStartDate: Date;
  subscriptionEndDate: Date;
  paidAt: Date | null;
  paymentMethod: string | null;
  transactionId: string | null;
  notes: string | null;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
}

export interface IPlatformSubscriptionInvoiceDocument extends IPlatformSubscriptionInvoice, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IPlatformSubscriptionInvoiceModel = Model<IPlatformSubscriptionInvoiceDocument>;

const platformSubscriptionInvoiceSchema = new Schema<
  IPlatformSubscriptionInvoiceDocument,
  IPlatformSubscriptionInvoiceModel
>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    planId: { type: Schema.Types.ObjectId, ref: 'PlatformSubscriptionPlan', required: true },
    planCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    planName: { type: String, required: true, trim: true, maxlength: 120 },
    billingCycle: {
      type: String,
      required: true,
      enum: ['MONTHLY', 'YEARLY', 'CUSTOM'],
      index: true,
    },
    invoiceNumber: { type: String, required: true, unique: true, trim: true, maxlength: 64 },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, min: 0, default: 0 },
    dueAmount: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      required: true,
      enum: Object.values(PLATFORM_SUBSCRIPTION_INVOICE_STATUS),
      default: PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID,
      index: true,
    },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true, index: true },
    subscriptionStartDate: { type: Date, required: true },
    subscriptionEndDate: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    paymentMethod: { type: String, trim: true, maxlength: 120, default: null },
    transactionId: { type: String, trim: true, maxlength: 200, default: null },
    notes: { type: String, trim: true, maxlength: 4000, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

platformSubscriptionInvoiceSchema.index({ libraryId: 1, status: 1 });
platformSubscriptionInvoiceSchema.index({ libraryId: 1, createdAt: -1 });

export const PlatformSubscriptionInvoiceModel: IPlatformSubscriptionInvoiceModel =
  (mongoose.models[MODEL_NAME] as IPlatformSubscriptionInvoiceModel) ||
  mongoose.model<IPlatformSubscriptionInvoiceDocument, IPlatformSubscriptionInvoiceModel>(
    MODEL_NAME,
    platformSubscriptionInvoiceSchema,
  );
