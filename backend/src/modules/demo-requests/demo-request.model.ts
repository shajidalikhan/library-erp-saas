import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import {
  DEMO_REQUEST_FEATURES,
  DEMO_REQUEST_STATUS,
  type DemoRequestFeature,
  type DemoRequestStatus,
} from './demo-request.constants';

const MODEL_NAME = 'DemoRequest';

export interface IDemoRequestStatusEvent {
  status: DemoRequestStatus;
  note?: string;
  changedBy?: Types.ObjectId | null;
  createdAt: Date;
}

export interface IDemoRequestAdminNote {
  body: string;
  authorId?: Types.ObjectId | null;
  createdAt: Date;
}

export interface IDemoRequest {
  fullName: string;
  email: string;
  phone: string;
  libraryName: string;
  city: string;
  branchCount: number;
  studentCount: number;
  currentSystem?: string;
  interestedFeatures: DemoRequestFeature[];
  notes?: string;
  status: DemoRequestStatus;
  assignedTo?: Types.ObjectId | null;
  statusHistory: IDemoRequestStatusEvent[];
  adminNotes: IDemoRequestAdminNote[];
}

export interface IDemoRequestDocument extends IDemoRequest, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IDemoRequestModel = Model<IDemoRequestDocument>;

const statusEventSchema = new Schema<IDemoRequestStatusEvent>(
  {
    status: { type: String, enum: Object.values(DEMO_REQUEST_STATUS), required: true },
    note: { type: String, trim: true, maxlength: 2000 },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const adminNoteSchema = new Schema<IDemoRequestAdminNote>(
  {
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const demoRequestSchema = new Schema<IDemoRequestDocument, IDemoRequestModel>(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    phone: { type: String, required: true, trim: true, minlength: 8, maxlength: 20 },
    libraryName: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
    city: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    branchCount: { type: Number, required: true, min: 1, max: 500 },
    studentCount: { type: Number, required: true, min: 1, max: 1_000_000 },
    currentSystem: { type: String, trim: true, maxlength: 160, default: '' },
    interestedFeatures: {
      type: [{ type: String, enum: DEMO_REQUEST_FEATURES }],
      default: [],
    },
    notes: { type: String, trim: true, maxlength: 4000, default: '' },
    status: {
      type: String,
      enum: Object.values(DEMO_REQUEST_STATUS),
      default: DEMO_REQUEST_STATUS.NEW,
      index: true,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    statusHistory: { type: [statusEventSchema], default: [] },
    adminNotes: { type: [adminNoteSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

demoRequestSchema.index({ createdAt: -1 });
demoRequestSchema.index({ email: 1, createdAt: -1 });

export const DemoRequestModel: IDemoRequestModel =
  (mongoose.models[MODEL_NAME] as IDemoRequestModel) ||
  mongoose.model<IDemoRequestDocument, IDemoRequestModel>(MODEL_NAME, demoRequestSchema);
