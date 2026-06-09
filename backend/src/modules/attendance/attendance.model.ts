import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

import { ATTENDANCE_METHOD, ATTENDANCE_STATUS, CHECKOUT_SOURCE } from './attendance.constants';
import type { AttendanceMethod, AttendanceStatus, CheckOutSource } from './attendance.constants';

const MODEL_NAME = 'Attendance';

export interface IAttendance {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  seatId: Types.ObjectId | null;
  date: Date;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  durationMinutes: number;
  status: AttendanceStatus;
  method: AttendanceMethod;
  checkOutSource?: CheckOutSource | null;
  notes?: string;
  createdBy: Types.ObjectId | null;
  updatedBy: Types.ObjectId | null;
}

export interface IAttendanceDocument extends IAttendance, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAttendanceModel extends Model<IAttendanceDocument> {}

const attendanceSchema = new Schema<IAttendanceDocument, IAttendanceModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat', default: null, index: true },
    date: { type: Date, required: true, index: true },
    checkInAt: { type: Date, default: null, index: true },
    checkOutAt: { type: Date, default: null, index: true },
    durationMinutes: { type: Number, default: 0, min: 0, index: true },
    status: {
      type: String,
      enum: ATTENDANCE_STATUS,
      default: 'CHECKED_IN',
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: ATTENDANCE_METHOD,
      default: 'MANUAL',
      required: true,
      index: true,
    },
    checkOutSource: {
      type: String,
      enum: CHECKOUT_SOURCE,
      default: null,
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
  },
);

// Prevent parallel active sessions for the same student within tenant scope.
attendanceSchema.index(
  { libraryId: 1, branchId: 1, studentId: 1, checkOutAt: 1 },
  { partialFilterExpression: { checkOutAt: null } },
);
attendanceSchema.index({ libraryId: 1, branchId: 1, date: 1, studentId: 1 });
attendanceSchema.index({ libraryId: 1, studentId: 1, date: -1 });

export const AttendanceModel: IAttendanceModel =
  (mongoose.models[MODEL_NAME] as IAttendanceModel) ||
  mongoose.model<IAttendanceDocument, IAttendanceModel>(MODEL_NAME, attendanceSchema);
