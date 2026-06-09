import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';

import {
  DEFAULT_TIMEZONE,
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from './library.constants';

const MODEL_NAME = 'Library';

export interface ILibrary {
  name: string;
  slug: string;
  ownerId: Types.ObjectId | null;
  email: string;
  phone?: string;
  gstNumber?: string;
  logo?: string | { url: string; publicId: string; uploadedAt?: Date };
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  timezone: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  /** SaaS period start (trial start or paid term start). */
  subscriptionStartsAt: Date | null;
  /** Current paid SaaS period end (renewed when subscription invoices are fully paid). */
  subscriptionEndsAt: Date | null;
  /** TRIAL | MONTHLY | YEARLY | CUSTOM — persisted for lifecycle UI. */
  billingCycle: string | null;
  suspendedAt: Date | null;
  suspensionReason: string | null;
  status: string;
  settings: Record<string, unknown>;
  /** Super-admin grants beyond plan (catalog keys). */
  enabledFeaturesOverride: string[];
  /** Super-admin revokes despite plan (catalog keys). */
  disabledFeaturesOverride: string[];
}

export interface ILibraryDocument extends ILibrary, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type ILibraryModel = Model<ILibraryDocument>;

const librarySchema = new Schema<ILibraryDocument, ILibraryModel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200, index: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'],
    },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    phone: { type: String, trim: true, maxlength: 32 },
    gstNumber: { type: String, trim: true, uppercase: true, maxlength: 32 },
    logo: { type: Schema.Types.Mixed },
    address: { type: String, trim: true, maxlength: 500 },
    city: { type: String, trim: true, maxlength: 120, index: true },
    state: { type: String, trim: true, maxlength: 120 },
    country: { type: String, trim: true, maxlength: 120, index: true },
    pincode: { type: String, trim: true, maxlength: 16 },
    timezone: { type: String, trim: true, default: DEFAULT_TIMEZONE, maxlength: 64 },
    subscriptionPlan: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLAN),
      default: SUBSCRIPTION_PLAN.BASIC,
      index: true,
    },
    subscriptionStatus: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.ACTIVE,
      index: true,
    },
    trialEndsAt: { type: Date, default: null, index: true },
    subscriptionStartsAt: { type: Date, default: null, index: true },
    subscriptionEndsAt: { type: Date, default: null, index: true },
    billingCycle: { type: String, trim: true, maxlength: 32, default: null, index: true },
    suspendedAt: { type: Date, default: null, index: true },
    suspensionReason: { type: String, trim: true, maxlength: 2000, default: null },
    status: {
      type: String,
      enum: Object.values(LIBRARY_STATUS),
      default: LIBRARY_STATUS.TRIAL,
      index: true,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    enabledFeaturesOverride: {
      type: [String],
      default: [],
    },
    disabledFeaturesOverride: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
  },
);

librarySchema.pre('save', async function libraryTrialDefaults() {
  if (!this.isNew) return;
  if (this.status === LIBRARY_STATUS.TRIAL && !this.trialEndsAt) {
    this.subscriptionStatus = SUBSCRIPTION_STATUS.TRIALING;
    const end = new Date();
    end.setDate(end.getDate() + 14);
    this.trialEndsAt = end;
  }
});

librarySchema.index({ name: 'text', slug: 'text', email: 'text', city: 'text' });

export const LibraryModel: ILibraryModel =
  (mongoose.models[MODEL_NAME] as ILibraryModel) ||
  mongoose.model<ILibraryDocument, ILibraryModel>(MODEL_NAME, librarySchema);
