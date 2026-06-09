import mongoose, { Schema, Types, type Document, type Model } from 'mongoose';
import type { RoleName } from '@constants/roles.constants';

const MODEL_NAME = 'Role';

/**
 * Role documents are seeded against the `ROLES` enum.
 * Each role references the permission documents it grants.
 *
 * Multi-tenant note:
 * - System roles are global (`isSystem: true`, `libraryId: null`).
 * - Future custom roles can be scoped to a library via `libraryId`.
 */
export interface IRole {
  name: RoleName | string;
  description?: string;
  permissions: Types.ObjectId[];
  isSystem: boolean;
  libraryId?: Types.ObjectId | null;
}

export interface IRoleDocument extends IRole, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRoleDocument>(
  {
    name: { type: String, required: true, trim: true, uppercase: true, index: true },
    description: { type: String, trim: true },
    permissions: [{ type: Schema.Types.ObjectId, ref: 'Permission', index: true }],
    isSystem: { type: Boolean, default: false, index: true },
    libraryId: {
      type: Schema.Types.ObjectId,
      ref: 'Library',
      default: null,
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

// (name + libraryId) must be unique. System roles have libraryId=null.
roleSchema.index({ name: 1, libraryId: 1 }, { unique: true });

/**
 * Idempotent registration - see notes in `permission.model.ts`.
 *
 * NOTE: `Role.permissions` uses `ref: 'Permission'`, so the Permission model
 * MUST be registered before any code calls `.populate('permissions')`.
 * This is guaranteed by importing models exclusively via `./auth.models.ts`.
 */
export const RoleModel: Model<IRoleDocument> =
  (mongoose.models[MODEL_NAME] as Model<IRoleDocument>) ||
  mongoose.model<IRoleDocument>(MODEL_NAME, roleSchema);
