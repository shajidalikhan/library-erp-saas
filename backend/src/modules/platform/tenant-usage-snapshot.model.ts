import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

const MODEL_NAME = 'TenantUsageSnapshot';

export interface ITenantUsageSnapshot {
  libraryId: Types.ObjectId;
  snapshotAt: Date;
  studentCount: number;
  staffCount: number;
  seatCount: number;
  branchCount: number;
  invoiceOpenCount: number;
  paymentCount30d: number;
  revenue30d: number;
}

export interface ITenantUsageSnapshotDocument extends ITenantUsageSnapshot, Document {
  _id: Types.ObjectId;
}

export type ITenantUsageSnapshotModel = Model<ITenantUsageSnapshotDocument>;

const snapSchema = new Schema<ITenantUsageSnapshotDocument, ITenantUsageSnapshotModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    snapshotAt: { type: Date, required: true, index: true },
    studentCount: { type: Number, default: 0 },
    staffCount: { type: Number, default: 0 },
    seatCount: { type: Number, default: 0 },
    branchCount: { type: Number, default: 0 },
    invoiceOpenCount: { type: Number, default: 0 },
    paymentCount30d: { type: Number, default: 0 },
    revenue30d: { type: Number, default: 0 },
  },
  { timestamps: false, versionKey: false },
);

snapSchema.index({ libraryId: 1, snapshotAt: -1 });

export const TenantUsageSnapshotModel: ITenantUsageSnapshotModel =
  (mongoose.models[MODEL_NAME] as ITenantUsageSnapshotModel) ||
  mongoose.model<ITenantUsageSnapshotDocument, ITenantUsageSnapshotModel>(MODEL_NAME, snapSchema);
