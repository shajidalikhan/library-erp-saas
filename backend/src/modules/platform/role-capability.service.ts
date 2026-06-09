import { ROLES, type RoleName } from '@constants/roles.constants';
import {
  CONFIGURABLE_STAFF_ROLES,
  ROLE_CAPABILITY_MODULES,
  type RoleCapabilityModule,
} from '@constants/role-capabilities.constants';
import {
  DEFAULT_ROLE_CAPABILITY_ACTION_MATRIX,
  MODULE_ACTIONS,
  deriveModuleFlagsFromActions,
  type RoleCapabilityActionMatrix,
} from '@constants/role-capability-actions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';

import { RoleCapabilityConfigModel } from './role-capability.model';

type StoredOverride =
  | boolean
  | Partial<Record<string, boolean>>
  | Partial<Record<RoleCapabilityModule, boolean | Partial<Record<string, boolean>>>>;

const cloneDefaultMatrix = (): RoleCapabilityActionMatrix =>
  JSON.parse(JSON.stringify(DEFAULT_ROLE_CAPABILITY_ACTION_MATRIX)) as RoleCapabilityActionMatrix;

const applyModuleBoolean = (
  row: RoleCapabilityActionMatrix[RoleName],
  module: RoleCapabilityModule,
  enabled: boolean,
): void => {
  for (const action of MODULE_ACTIONS[module]) {
    (row[module] as Record<string, boolean>)[action] = enabled;
  }
};

const mergeMatrixFromDb = (
  overrides: Partial<Record<RoleName, StoredOverride>>,
): RoleCapabilityActionMatrix => {
  const result = cloneDefaultMatrix();

  for (const role of CONFIGURABLE_STAFF_ROLES) {
    const patch = overrides[role];
    if (!patch || typeof patch !== 'object') continue;

    const keys = Object.keys(patch as object);
    const isActionMatrixRow = keys.some((k) =>
      ROLE_CAPABILITY_MODULES.includes(k as RoleCapabilityModule),
    );

    if (isActionMatrixRow) {
      for (const mod of ROLE_CAPABILITY_MODULES) {
        const val = (patch as Record<string, unknown>)[mod];
        if (val === undefined) continue;
        if (typeof val === 'boolean') {
          applyModuleBoolean(result[role], mod, val);
        } else if (typeof val === 'object' && val !== null) {
          for (const [action, enabled] of Object.entries(val)) {
            if (enabled !== undefined && action in result[role][mod]) {
              (result[role][mod] as Record<string, boolean>)[action] = Boolean(enabled);
            }
          }
        }
      }
    }
  }

  return result;
};

class RoleCapabilityService {
  private cachedActions: RoleCapabilityActionMatrix | null = null;

  invalidateCache(): void {
    this.cachedActions = null;
  }

  async getActionMatrix(): Promise<RoleCapabilityActionMatrix> {
    if (this.cachedActions) return this.cachedActions;
    const doc = await RoleCapabilityConfigModel.findOne({ singletonKey: 'default' }).lean();
    const overrides = (doc?.overrides ?? {}) as Partial<Record<RoleName, StoredOverride>>;
    this.cachedActions = mergeMatrixFromDb(overrides);
    return this.cachedActions;
  }

  async getActionMatrixForRole(role: RoleName): Promise<RoleCapabilityActionMatrix[RoleName]> {
    const matrix = await this.getActionMatrix();
    return matrix[role] ?? DEFAULT_ROLE_CAPABILITY_ACTION_MATRIX[role];
  }

  async getModulesForRole(role: RoleName): Promise<Record<RoleCapabilityModule, boolean>> {
    const actions = await this.getActionMatrixForRole(role);
    return deriveModuleFlagsFromActions(actions);
  }

  async isActionEnabled(
    role: RoleName,
    module: RoleCapabilityModule,
    action: string,
  ): Promise<boolean> {
    if (role === ROLES.SUPER_ADMIN || role === ROLES.LIBRARY_OWNER) return true;
    const row = await this.getActionMatrixForRole(role);
    return Boolean((row[module] as Record<string, boolean>)[action]);
  }

  async isModuleEnabled(role: RoleName, module: RoleCapabilityModule): Promise<boolean> {
    if (role === ROLES.SUPER_ADMIN || role === ROLES.LIBRARY_OWNER) return true;
    const modules = await this.getModulesForRole(role);
    return Boolean(modules[module]);
  }

  async assertActionEnabledAsync(
    user: AuthenticatedUser,
    module: RoleCapabilityModule,
    action: string,
  ): Promise<void> {
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.LIBRARY_OWNER) return;
    const enabled = await this.isActionEnabled(user.role, module, action);
    if (!enabled) {
      throw ApiError.forbidden('You do not have access to this feature.', {
        code: 'ROLE_CAPABILITY_DENIED',
        module,
        action,
      });
    }
  }

  async assertModuleEnabledAsync(
    user: AuthenticatedUser,
    module: RoleCapabilityModule,
  ): Promise<void> {
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.LIBRARY_OWNER) return;
    const enabled = await this.isModuleEnabled(user.role, module);
    if (!enabled) {
      throw ApiError.forbidden('You do not have access to this feature.', {
        code: 'ROLE_CAPABILITY_DENIED',
        module,
      });
    }
  }

  async getConfigurableMatrix(): Promise<{
    roles: RoleName[];
    modules: typeof ROLE_CAPABILITY_MODULES;
    moduleActions: typeof MODULE_ACTIONS;
    matrix: Pick<RoleCapabilityActionMatrix, (typeof CONFIGURABLE_STAFF_ROLES)[number]>;
    defaults: Pick<RoleCapabilityActionMatrix, (typeof CONFIGURABLE_STAFF_ROLES)[number]>;
    moduleFlags: Record<
      RoleName,
      Record<RoleCapabilityModule, boolean>
    >;
  }> {
    const full = await this.getActionMatrix();
    const defaults = Object.fromEntries(
      CONFIGURABLE_STAFF_ROLES.map((r) => [r, DEFAULT_ROLE_CAPABILITY_ACTION_MATRIX[r]]),
    ) as Pick<RoleCapabilityActionMatrix, (typeof CONFIGURABLE_STAFF_ROLES)[number]>;
    const matrix = Object.fromEntries(
      CONFIGURABLE_STAFF_ROLES.map((r) => [r, full[r]]),
    ) as Pick<RoleCapabilityActionMatrix, (typeof CONFIGURABLE_STAFF_ROLES)[number]>;
    const moduleFlags = Object.fromEntries(
      CONFIGURABLE_STAFF_ROLES.map((r) => [r, deriveModuleFlagsFromActions(full[r])]),
    ) as Record<RoleName, Record<RoleCapabilityModule, boolean>>;
    return {
      roles: CONFIGURABLE_STAFF_ROLES,
      modules: ROLE_CAPABILITY_MODULES,
      moduleActions: MODULE_ACTIONS,
      matrix,
      defaults,
      moduleFlags,
    };
  }

  async patchRoleCapabilities(
    role: RoleName,
    patch: {
      modules?: Partial<Record<RoleCapabilityModule, boolean>>;
      actions?: Partial<
        Record<RoleCapabilityModule, Partial<Record<string, boolean>>>
      >;
    },
  ): Promise<RoleCapabilityActionMatrix[RoleName]> {
    if (!CONFIGURABLE_STAFF_ROLES.includes(role)) {
      throw ApiError.badRequest('Only staff roles can be configured');
    }

    const existing = await RoleCapabilityConfigModel.findOne({ singletonKey: 'default' }).lean();
    const overrides = {
      ...((existing?.overrides ?? {}) as Record<RoleName, StoredOverride>),
    };

    const currentRow = (await this.getActionMatrix())[role];
    const nextRow = JSON.parse(JSON.stringify(currentRow)) as RoleCapabilityActionMatrix[RoleName];

    if (patch.modules) {
      for (const [mod, enabled] of Object.entries(patch.modules)) {
        if (enabled === undefined) continue;
        applyModuleBoolean(nextRow, mod as RoleCapabilityModule, enabled);
      }
    }
    if (patch.actions) {
      for (const [mod, actionPatch] of Object.entries(patch.actions)) {
        if (!actionPatch) continue;
        for (const [action, enabled] of Object.entries(actionPatch)) {
          if (enabled !== undefined && action in nextRow[mod as RoleCapabilityModule]) {
            (nextRow[mod as RoleCapabilityModule] as Record<string, boolean>)[action] =
              enabled;
          }
        }
      }
    }

    overrides[role] = nextRow as unknown as StoredOverride;

    await RoleCapabilityConfigModel.findOneAndUpdate(
      { singletonKey: 'default' },
      { $set: { overrides } },
      { upsert: true, new: true },
    );
    this.invalidateCache();
    return nextRow;
  }

  /** @deprecated Use patchRoleCapabilities */
  async patchRoleModules(
    role: RoleName,
    modules: Partial<Record<RoleCapabilityModule, boolean>>,
  ): Promise<Record<RoleCapabilityModule, boolean>> {
    const row = await this.patchRoleCapabilities(role, { modules });
    return deriveModuleFlagsFromActions(row);
  }
}

export const roleCapabilityService = new RoleCapabilityService();
