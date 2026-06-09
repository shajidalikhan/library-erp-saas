import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { ENV } from '@config/env.config';

const MODEL_NAME = 'User';

/**
 * User document - represents every human in the platform regardless of role
 * (super admin, library owner, staff, student).
 *
 * Multi-tenancy:
 *   - SUPER_ADMIN  : libraryId == null, branchId == null
 *   - LIBRARY_OWNER: libraryId set, branchId == null
 *   - other staff  : libraryId + branchId set
 *   - STUDENT      : libraryId + branchId set
 *
 * Refresh-token rotation:
 *   - We store hashed refresh tokens so we can detect reuse and revoke them.
 *   - Logout/refresh helpers live in `auth.service.ts`.
 */

export interface IRefreshTokenEntry {
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface INotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

export interface IUser {
  fullName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: Types.ObjectId;       // Role reference
  libraryId: Types.ObjectId | null;
  branchId: Types.ObjectId | null;
  isActive: boolean;
  status: string;
  isRootSuperAdmin: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: Date | null;
  refreshTokens: IRefreshTokenEntry[];
  resetPasswordTokenHash?: string | null;
  resetPasswordExpiresAt?: Date | null;
  notificationPreferences?: INotificationPreferences;
}

export interface IUserDocument extends IUser, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(plain: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUserDocument> {
  hashPassword(plain: string): Promise<string>;
}

const refreshTokenSchema = new Schema<IRefreshTokenEntry>(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    userAgent: { type: String },
    ipAddress: { type: String },
  },
  { _id: false },
);

const userSchema = new Schema<IUserDocument, IUserModel>(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    phone: { type: String, trim: true, sparse: true, index: true },
    passwordHash: { type: String, required: true, select: false },

    role: { type: Schema.Types.ObjectId, ref: 'Role', required: true, index: true },

    libraryId: {
      type: Schema.Types.ObjectId,
      ref: 'Library',
      default: null,
      index: true,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },

    isActive: { type: Boolean, default: true, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'DELETED'],
      default: 'ACTIVE',
      index: true,
    },
    isRootSuperAdmin: { type: Boolean, default: false, index: true },
    isEmailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date, default: null },

    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    resetPasswordTokenHash: { type: String, default: null, select: false, index: true },
    resetPasswordExpiresAt: { type: Date, default: null, select: false, index: true },
    notificationPreferences: {
      type: new Schema(
        {
          emailEnabled: { type: Boolean, default: true },
          inAppEnabled: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: () => ({ emailEnabled: true, inAppEnabled: true }),
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.refreshTokens;
        delete ret.resetPasswordTokenHash;
        delete ret.resetPasswordExpiresAt;
        return ret;
      },
    },
  },
);

// Compound index helps tenant-scoped lookups.
userSchema.index({ libraryId: 1, email: 1 });
userSchema.index({ libraryId: 1, branchId: 1 });

userSchema.statics.hashPassword = async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ENV.BCRYPT_SALT_ROUNDS);
};

userSchema.methods.comparePassword = async function comparePassword(plain: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

/**
 * Idempotent registration - see notes in `permission.model.ts`.
 *
 * NOTE: `User.role` uses `ref: 'Role'`, so the Role (and transitively the
 * Permission) model MUST be registered before `.populate('role')` runs.
 * Importing via `./auth.models.ts` guarantees that ordering.
 */
export const UserModel: IUserModel =
  (mongoose.models[MODEL_NAME] as IUserModel) ||
  mongoose.model<IUserDocument, IUserModel>(MODEL_NAME, userSchema);
