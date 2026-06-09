import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { mediaAssetSchema } from '@utils/media-asset.schema';

const MODEL_NAME = 'Branch';

export interface IBranch {
  libraryId: Types.ObjectId;
  branchName: string;
  branchCode: string;
  managerId: Types.ObjectId | null;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  totalSeats: number;
  active: boolean;
  logo?: { url: string; publicId: string };
}

export interface IBranchDocument extends IBranch, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IBranchModel = Model<IBranchDocument>;

const branchSchema = new Schema<IBranchDocument, IBranchModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchName: { type: String, required: true, trim: true, maxlength: 200, index: true },
    branchCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 32,
    },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    phone: { type: String, trim: true, maxlength: 32 },
    address: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    pincode: { type: String, trim: true, maxlength: 16 },
    totalSeats: { type: Number, default: 0, min: 0, index: true },
    active: { type: Boolean, default: true, index: true },
    logo: { type: mediaAssetSchema, default: undefined },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
  },
);

branchSchema.index({ libraryId: 1, branchCode: 1 }, { unique: true });
branchSchema.index({ branchName: 'text', branchCode: 'text', city: 'text', email: 'text' });

export const BranchModel: IBranchModel =
  (mongoose.models[MODEL_NAME] as IBranchModel) ||
  mongoose.model<IBranchDocument, IBranchModel>(MODEL_NAME, branchSchema);
