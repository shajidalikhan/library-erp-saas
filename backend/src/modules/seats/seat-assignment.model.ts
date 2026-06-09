import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

const MODEL_NAME = 'SeatAssignment';

export interface ISeatAssignment {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  seatId: Types.ObjectId;
  studentId: Types.ObjectId;
  shiftId: Types.ObjectId;
  membershipId?: Types.ObjectId | null;
  startDate: Date;
  endDate: Date | null;
  status: string;
  assignedBy: Types.ObjectId;
  /** When the assignment was ended early (inactive student, transfer, etc.). */
  endedAt?: Date | null;
  releasedReason?: string | null;
}

export interface ISeatAssignmentDocument extends ISeatAssignment, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ISeatAssignmentModel = Model<ISeatAssignmentDocument>;

const seatAssignmentSchema = new Schema<ISeatAssignmentDocument, ISeatAssignmentModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    seatId: { type: Schema.Types.ObjectId, ref: 'Seat', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true, index: true },
    membershipId: { type: Schema.Types.ObjectId, ref: 'Membership', default: null, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    status: {
      type: String,
      enum: Object.values(SHIFT_ASSIGNMENT_STATUS),
      default: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
      index: true,
    },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    endedAt: { type: Date, default: null },
    releasedReason: { type: String, default: null, trim: true },
  },
  { timestamps: true, versionKey: false },
);

seatAssignmentSchema.index(
  { seatId: 1, shiftId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: SHIFT_ASSIGNMENT_STATUS.ACTIVE },
  },
);

export const SeatAssignmentModel: ISeatAssignmentModel =
  (mongoose.models[MODEL_NAME] as ISeatAssignmentModel) ||
  mongoose.model<ISeatAssignmentDocument, ISeatAssignmentModel>(
    MODEL_NAME,
    seatAssignmentSchema,
  );
