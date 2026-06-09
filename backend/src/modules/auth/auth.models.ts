/**
 * Auth-module model registry.
 *
 * Goals:
 *  1. Guarantee deterministic Mongoose model registration order:
 *       Permission -> Role -> User
 *     This is critical because:
 *       - `Role.permissions` references `Permission`
 *       - `User.role`        references `Role`
 *     Populating a parent before the referenced model is registered
 *     throws "Schema hasn't been registered for model X".
 *
 *  2. Provide a single, canonical import path for all auth-module models so
 *     downstream code (services, middlewares, seeders) cannot accidentally
 *     load only a subset.
 *
 *  3. Avoid circular dependencies: this file only imports the three model
 *     files and re-exports them. No service / middleware imports.
 *
 * Anywhere a model is used (services, middlewares, seeders), import from
 * this barrel - never from the individual `*.model.ts` files.
 */

import { PermissionModel } from './permission.model';
import { RoleModel } from './role.model';
import { UserModel } from './user.model';

// Re-export models for convenient consumption.
export { PermissionModel } from './permission.model';
export { RoleModel } from './role.model';
export { UserModel } from './user.model';

// Re-export shared types so callers can stay on this barrel.
export type {
  IPermission,
  IPermissionDocument,
} from './permission.model';
export type { IRole, IRoleDocument } from './role.model';
export type {
  IUser,
  IUserDocument,
  IUserModel,
  IRefreshTokenEntry,
} from './user.model';

/**
 * Touching the model references at module load time forces Mongoose to
 * register each schema even if the consumer only destructures one model.
 * Order is significant - keep Permission first.
 */
export const __registeredModels = [
  PermissionModel.modelName,
  RoleModel.modelName,
  UserModel.modelName,
] as const;
