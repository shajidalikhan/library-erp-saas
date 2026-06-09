import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import type { EmailTemplateKey } from './email-template.constants';

const MODEL_NAME = 'EmailTemplate';

export interface IEmailTemplate {
  key: EmailTemplateKey;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  active: boolean;
  updatedBy: Types.ObjectId | null;
}

export interface IEmailTemplateDocument extends IEmailTemplate, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IEmailTemplateModel = Model<IEmailTemplateDocument>;

const emailTemplateSchema = new Schema<IEmailTemplateDocument, IEmailTemplateModel>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    subject: { type: String, required: true, trim: true, maxlength: 300 },
    htmlBody: { type: String, required: true, maxlength: 50_000 },
    textBody: { type: String, required: true, maxlength: 20_000 },
    variables: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, versionKey: false },
);

export const EmailTemplateModel: IEmailTemplateModel =
  (mongoose.models[MODEL_NAME] as IEmailTemplateModel) ||
  mongoose.model<IEmailTemplateDocument, IEmailTemplateModel>(MODEL_NAME, emailTemplateSchema);
