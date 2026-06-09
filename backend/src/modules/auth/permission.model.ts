import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';
import type { PermissionName } from '@constants/permissions.constants';

const MODEL_NAME = 'Permission';

/**
 * Permission documents map 1:1 to entries in the `PERMISSIONS` catalog.
 * They are seeded once and rarely change.
 */
export interface IPermission {
  name: PermissionName;
  description?: string;
  group: string; // e.g. "user", "seat" - parsed from `name.split('.')[0]`
}

export interface IPermissionDocument extends IPermission, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const permissionSchema = new Schema<IPermissionDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: { type: String, trim: true },
    group: { type: String, required: true, lowercase: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

/**
 * Idempotent model registration.
 *
 * Why: in dev with `tsx --watch` (HMR), in test runners that re-import modules,
 * or when a barrel re-imports a model file twice, calling `mongoose.model(name, schema)`
 * a second time throws `OverwriteModelError`. Re-using `mongoose.models[name]`
 * keeps a single registered Schema regardless of import path.
 */
export const PermissionModel: Model<IPermissionDocument> =
  (mongoose.models[MODEL_NAME] as Model<IPermissionDocument>) ||
  mongoose.model<IPermissionDocument>(MODEL_NAME, permissionSchema);
