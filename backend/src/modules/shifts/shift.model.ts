import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { SEAT_TYPES } from '@modules/seats/seat.constants';
import { SHIFT_KINDS, type ShiftKind } from './shift.constants';

const MODEL_NAME = 'Shift';

export interface IShift {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  name: string;
  startTime: string;
  endTime: string;
  type: ShiftKind;
  description?: string;
  active: boolean;
  color: string;
  allowedSeatTypes: string[];
  priceMultiplier: number;
}

export interface IShiftDocument extends IShift, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IShiftModel = Model<IShiftDocument>;

const shiftSchema = new Schema<IShiftDocument, IShiftModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80, index: true },
    startTime: { type: String, required: true, trim: true, maxlength: 8 },
    endTime: { type: String, required: true, trim: true, maxlength: 8 },
    type: {
      type: String,
      enum: SHIFT_KINDS,
      default: 'CUSTOM',
      index: true,
    },
    description: { type: String, trim: true, maxlength: 500 },
    active: { type: Boolean, default: true, index: true },
    color: { type: String, trim: true, maxlength: 16, default: '#3b82f6' },
    allowedSeatTypes: {
      type: [String],
      enum: SEAT_TYPES,
      default: () => ['STANDARD', 'PREMIUM', 'CABIN', 'SILENT_ZONE'],
    },
    priceMultiplier: { type: Number, default: 1, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

shiftSchema.index({ libraryId: 1, branchId: 1, name: 1 }, { unique: true });

export const ShiftModel: IShiftModel =
  (mongoose.models[MODEL_NAME] as IShiftModel) ||
  mongoose.model<IShiftDocument, IShiftModel>(MODEL_NAME, shiftSchema);
