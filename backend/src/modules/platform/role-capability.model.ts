import mongoose, { Schema, type Document, type Model } from 'mongoose';

import type { RoleName } from '@constants/roles.constants';
import type { RoleCapabilityModule } from '@constants/role-capabilities.constants';

const MODEL_NAME = 'RoleCapabilityConfig';

export interface IRoleCapabilityConfig {
  singletonKey: 'default';
  /** Partial overrides: role -> module -> enabled */
  overrides: Partial<Record<RoleName, Partial<Record<RoleCapabilityModule, boolean>>>>;
}

export interface IRoleCapabilityConfigDocument extends IRoleCapabilityConfig, Document {
  _id: mongoose.Types.ObjectId;
  updatedAt: Date;
  createdAt: Date;
}

export type IRoleCapabilityConfigModel = Model<IRoleCapabilityConfigDocument>;

const roleCapabilityConfigSchema = new Schema<IRoleCapabilityConfigDocument, IRoleCapabilityConfigModel>(
  {
    singletonKey: { type: String, required: true, unique: true, default: 'default' },
    overrides: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const RoleCapabilityConfigModel =
  (mongoose.models[MODEL_NAME] as IRoleCapabilityConfigModel | undefined) ??
  mongoose.model<IRoleCapabilityConfigDocument, IRoleCapabilityConfigModel>(
    MODEL_NAME,
    roleCapabilityConfigSchema,
  );
