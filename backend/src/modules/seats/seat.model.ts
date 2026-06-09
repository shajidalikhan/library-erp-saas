import mongoose, { Schema, type Types, type Document, type Model } from 'mongoose';

import type { SeatStatus, SeatType, ShiftType } from './seat.constants';
import { SEAT_STATUSES, SEAT_TYPES, SHIFT_TYPES } from './seat.constants';

const MODEL_NAME = 'Seat';

export interface ISeat {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  seatNumber: string;
  floor: string;
  zone: string;
  seatType: SeatType;
  shiftType?: ShiftType;
  assignedStudentId: Types.ObjectId | null;
  occupied: boolean;
  active: boolean;
  status: SeatStatus;
  notes?: string;
  reservedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISeatDocument extends ISeat, Document {}
export interface ISeatModel extends Model<ISeatDocument> {}

const seatSchema = new Schema<ISeatDocument, ISeatModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    seatNumber: { type: String, required: true, trim: true, maxlength: 40 },
    floor: { type: String, required: true, trim: true, maxlength: 40, default: '1' },
    zone: { type: String, required: true, trim: true, maxlength: 80, default: 'General' },
    seatType: {
      type: String,
      required: true,
      enum: SEAT_TYPES,
      default: 'STANDARD',
      index: true,
    },
    /** @deprecated Use SeatAssignment + Shift. Kept for legacy data migration only. */
    shiftType: {
      type: String,
      enum: SHIFT_TYPES,
      required: false,
      select: false,
    },
    assignedStudentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    occupied: { type: Boolean, default: false, index: true },
    active: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      required: true,
      enum: SEAT_STATUSES,
      default: 'AVAILABLE',
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 500 },
    reservedUntil: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
  },
);

seatSchema.index({ branchId: 1, seatNumber: 1 }, { unique: true });
seatSchema.index({ libraryId: 1, branchId: 1, floor: 1, zone: 1 });
seatSchema.index({ libraryId: 1, branchId: 1, status: 1 });
seatSchema.index({ libraryId: 1, branchId: 1, occupied: 1 });

export const SeatModel: ISeatModel =
  (mongoose.models[MODEL_NAME] as ISeatModel) ||
  mongoose.model<ISeatDocument, ISeatModel>(MODEL_NAME, seatSchema);
