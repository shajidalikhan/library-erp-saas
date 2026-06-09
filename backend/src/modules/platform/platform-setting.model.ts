import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

const MODEL_NAME = 'PlatformSetting';

export interface IPlatformSetting {
  /** Singleton row key */
  singletonKey: string;
  supportEmail: string;
  salesEmail: string;
  demoRequestNotifyEmail: string;
  /** Shown on billing / suspension screens */
  supportPhone?: string;
  billingPhone?: string;
  whatsappSupport?: string;
  showSupportEmail?: boolean;
  showSupportPhone?: boolean;
  showWhatsappSupport?: boolean;
  showSalesEmail?: boolean;
  /** Default trial length when provisioning a library (days). */
  defaultTrialDays?: number;
  maintenanceMode: boolean;
  /** Arbitrary feature toggles for the SaaS layer */
  featureFlags: Record<string, boolean>;
  /** Reserved for impersonation policy (future). */
  impersonationEnabled: boolean;
  impersonationNotes: string;
}

export interface IPlatformSettingDocument extends IPlatformSetting, Document {
  _id: Types.ObjectId;
  updatedAt: Date;
}

export type IPlatformSettingModel = Model<IPlatformSettingDocument>;

const platformSettingSchema = new Schema<IPlatformSettingDocument, IPlatformSettingModel>(
  {
    singletonKey: { type: String, required: true, unique: true, default: 'default', maxlength: 32 },
    supportEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: 'support@example.com' },
    salesEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
    demoRequestNotifyEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
    supportPhone: { type: String, trim: true, maxlength: 32, default: '' },
    billingPhone: { type: String, trim: true, maxlength: 32, default: '' },
    whatsappSupport: { type: String, trim: true, maxlength: 32, default: '' },
    showSupportEmail: { type: Boolean, default: true },
    showSupportPhone: { type: Boolean, default: true },
    showWhatsappSupport: { type: Boolean, default: false },
    showSalesEmail: { type: Boolean, default: true },
    defaultTrialDays: { type: Number, min: 1, max: 90, default: 14 },
    maintenanceMode: { type: Boolean, default: false },
    featureFlags: { type: Schema.Types.Mixed, default: {} },
    impersonationEnabled: { type: Boolean, default: false },
    impersonationNotes: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: { createdAt: false, updatedAt: true }, versionKey: false },
);

export const PlatformSettingModel: IPlatformSettingModel =
  (mongoose.models[MODEL_NAME] as IPlatformSettingModel) ||
  mongoose.model<IPlatformSettingDocument, IPlatformSettingModel>(MODEL_NAME, platformSettingSchema);
