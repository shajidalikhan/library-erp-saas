import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

const MODEL_NAME = 'StudentFieldConfig';

export const STUDENT_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT', 'BOOLEAN', 'FILE'] as const;
export type StudentFieldType = (typeof STUDENT_FIELD_TYPES)[number];

export interface IStudentFieldConfig {
  libraryId: Types.ObjectId;
  fieldKey: string;
  label: string;
  type: StudentFieldType;
  required: boolean;
  options: string[];
  active: boolean;
  order: number;
}

export interface IStudentFieldConfigDocument extends IStudentFieldConfig, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IStudentFieldConfigModel = Model<IStudentFieldConfigDocument>;

const studentFieldConfigSchema = new Schema<IStudentFieldConfigDocument, IStudentFieldConfigModel>(
  {
    libraryId: { type: Schema.Types.ObjectId, ref: 'Library', required: true, index: true },
    fieldKey: { type: String, required: true, trim: true, maxlength: 64 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: STUDENT_FIELD_TYPES, required: true },
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  { timestamps: true, versionKey: false },
);

studentFieldConfigSchema.index({ libraryId: 1, fieldKey: 1 }, { unique: true });

export const StudentFieldConfigModel: IStudentFieldConfigModel =
  (mongoose.models[MODEL_NAME] as IStudentFieldConfigModel) ||
  mongoose.model<IStudentFieldConfigDocument, IStudentFieldConfigModel>(
    MODEL_NAME,
    studentFieldConfigSchema,
  );
