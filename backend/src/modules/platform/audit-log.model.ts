import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

const MODEL_NAME = 'AuditLog';

export interface IAuditLog {
  actorUserId: Types.ObjectId | null;
  action: string;
  entityType: string;
  entityId: Types.ObjectId | null;
  libraryId: Types.ObjectId | null;
  branchId: Types.ObjectId | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface IAuditLogDocument extends IAuditLog, Document {
  _id: Types.ObjectId;
  createdAt: Date;
}

export type IAuditLogModel = Model<IAuditLogDocument>;

const auditLogSchema = new Schema<IAuditLogDocument, IAuditLogModel>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    action: { type: String, required: true, trim: true, maxlength: 120, index: true },
    entityType: { type: String, required: true, trim: true, maxlength: 80, index: true },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', default: null, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, trim: true, maxlength: 64, default: null },
    userAgent: { type: String, trim: true, maxlength: 512, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ libraryId: 1, createdAt: -1 });

export const AuditLogModel: IAuditLogModel =
  (mongoose.models[MODEL_NAME] as IAuditLogModel) ||
  mongoose.model<IAuditLogDocument, IAuditLogModel>(MODEL_NAME, auditLogSchema);
