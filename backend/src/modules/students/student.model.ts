import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import { documentProofSchema, mediaAssetSchema } from '@utils/media-asset.schema';

import { STUDENT_GENDER, STUDENT_STATUS } from './student.constants';

const MODEL_NAME = 'Student';

export interface IStudent {
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  studentId: string;
  fullName: string;
  email: string;
  phone?: string;
  gender: string;
  dateOfBirth?: Date | null;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  guardianName?: string;
  guardianPhone?: string;
  parentContactPhone?: string;
  correspondenceAddress?: string;
  qualification?: string;
  aadhaarNumber?: string;
  profilePhoto?: { url: string; publicId: string } | string;
  documentProof?: { url: string; publicId: string; type?: string };
  customFields?: Record<string, unknown>;
  currentShiftId?: Types.ObjectId | null;
  admissionDate: Date;
  membershipStartDate: Date;
  membershipEndDate?: Date | null;
  status: string;
  notes?: string;
  assignedSeatId: Types.ObjectId | null;
  userId: Types.ObjectId | null;
}

export interface IStudentDocument extends IStudent, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IStudentModel = Model<IStudentDocument>;

const studentSchema = new Schema<IStudentDocument, IStudentModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    studentId: { type: String, required: true, trim: true, maxlength: 64, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120, index: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    phone: { type: String, trim: true, maxlength: 32, sparse: true, index: true },
    gender: {
      type: String,
      enum: Object.values(STUDENT_GENDER),
      default: STUDENT_GENDER.UNSPECIFIED,
      index: true,
    },
    dateOfBirth: { type: Date, default: null },
    address: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 120, index: true },
    state: { type: String, trim: true, maxlength: 120 },
    pincode: { type: String, trim: true, maxlength: 16 },
    emergencyContactName: { type: String, trim: true, maxlength: 120 },
    emergencyContactPhone: { type: String, trim: true, maxlength: 32 },
    guardianName: { type: String, trim: true, maxlength: 120 },
    guardianPhone: { type: String, trim: true, maxlength: 32 },
    parentContactPhone: { type: String, trim: true, maxlength: 32 },
    correspondenceAddress: { type: String, trim: true, maxlength: 500 },
    qualification: { type: String, trim: true, maxlength: 200 },
    aadhaarNumber: { type: String, trim: true, maxlength: 20, sparse: true },
    profilePhoto: { type: Schema.Types.Mixed },
    documentProof: { type: documentProofSchema, default: undefined },
    customFields: { type: Schema.Types.Mixed, default: {} },
    currentShiftId: { type: Schema.Types.ObjectId, ref: 'Shift', default: null, index: true },
    admissionDate: { type: Date, required: true, index: true },
    membershipStartDate: { type: Date, required: true, index: true },
    membershipEndDate: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: Object.values(STUDENT_STATUS),
      default: STUDENT_STATUS.ACTIVE,
      index: true,
    },
    notes: { type: String, trim: true, maxlength: 5000 },
    assignedSeatId: { type: Schema.Types.ObjectId, ref: 'Seat', default: null, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, sparse: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
  },
);

studentSchema.index({ libraryId: 1, studentId: 1 }, { unique: true });
studentSchema.index({ libraryId: 1, branchId: 1, status: 1 });
studentSchema.index({ libraryId: 1, email: 1 });
studentSchema.index({ userId: 1 }, { unique: true, sparse: true });
studentSchema.index(
  { fullName: 'text', studentId: 'text', email: 'text', phone: 'text', city: 'text' },
);

export const StudentModel: IStudentModel =
  (mongoose.models[MODEL_NAME] as IStudentModel) ||
  mongoose.model<IStudentDocument, IStudentModel>(MODEL_NAME, studentSchema);
