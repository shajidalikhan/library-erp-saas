import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

import {
  PUBLIC_BOOKING_STATUS,
  PUBLIC_PAYMENT_MODE,
  PUBLIC_PAYMENT_STATUS,
} from './public-booking.constants';

const MODEL_NAME = 'PublicSeatBooking';

export interface IPublicSeatBooking {
  bookingReference: string;
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  shiftId: Types.ObjectId;
  seatId: Types.ObjectId;
  feePlanId: Types.ObjectId;
  selectedSeatNumber: string;
  selectedShiftName: string;
  fullName: string;
  phone: string;
  email?: string;
  guardianName?: string;
  guardianPhone?: string;
  city?: string;
  state?: string;
  pincode?: string;
  amount: number;
  paymentMode: string;
  paymentStatus: string;
  bookingStatus: string;
  expiresAt: Date | null;
  notes?: string;
  address?: string;
  customFields?: Record<string, unknown>;
  convertedAt?: Date | null;
  convertedStudentId?: Types.ObjectId | null;
}

export interface IPublicSeatBookingDocument extends IPublicSeatBooking, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IPublicSeatBookingModel = Model<IPublicSeatBookingDocument>;

const publicSeatBookingSchema = new Schema<IPublicSeatBookingDocument, IPublicSeatBookingModel>(
  {
    bookingReference: { type: String, required: true, trim: true, maxlength: 64, index: true },
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true, index: true },
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat', required: true, index: true },
    feePlanId: { type: Schema.Types.ObjectId, ref: 'FeePlan', required: true, index: true },
    selectedSeatNumber: { type: String, required: true, trim: true, maxlength: 40 },
    selectedShiftName: { type: String, required: true, trim: true, maxlength: 80 },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 32, index: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 160 },
    guardianName: { type: String, trim: true, maxlength: 120 },
    guardianPhone: { type: String, trim: true, maxlength: 32 },
    city: { type: String, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120 },
    pincode: { type: String, trim: true, maxlength: 16 },
    amount: { type: Number, required: true, min: 0 },
    paymentMode: {
      type: String,
      enum: Object.values(PUBLIC_PAYMENT_MODE),
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PUBLIC_PAYMENT_STATUS),
      required: true,
      index: true,
      default: PUBLIC_PAYMENT_STATUS.PENDING_OFFLINE,
    },
    bookingStatus: {
      type: String,
      enum: Object.values(PUBLIC_BOOKING_STATUS),
      required: true,
      default: PUBLIC_BOOKING_STATUS.HOLD,
      index: true,
    },
    expiresAt: { type: Date, default: null, index: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    address: { type: String, trim: true, maxlength: 500 },
    customFields: { type: Schema.Types.Mixed, default: {} },
    convertedAt: { type: Date, default: null, index: true },
    convertedStudentId: { type: Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
  },
  { timestamps: true, versionKey: false },
);

publicSeatBookingSchema.index(
  { seatId: 1, shiftId: 1, bookingStatus: 1 },
  {
    unique: true,
    partialFilterExpression: {
      bookingStatus: {
        $in: [PUBLIC_BOOKING_STATUS.HOLD, PUBLIC_BOOKING_STATUS.APPROVED],
      },
    },
  },
);

publicSeatBookingSchema.index({ libraryId: 1, branchId: 1, createdAt: -1 });
publicSeatBookingSchema.index({ libraryId: 1, bookingReference: 1 }, { unique: true });

export const PublicSeatBookingModel: IPublicSeatBookingModel =
  (mongoose.models[MODEL_NAME] as IPublicSeatBookingModel) ||
  mongoose.model<IPublicSeatBookingDocument, IPublicSeatBookingModel>(
    MODEL_NAME,
    publicSeatBookingSchema,
  );
