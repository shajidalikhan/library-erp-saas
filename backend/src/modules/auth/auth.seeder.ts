/**
 * RBAC Seeder
 * ===========
 * Idempotently seeds the system Permissions and Roles required by the platform.
 *
 * Run manually:
 *   npm run seed:rbac
 *
 * Safe to run multiple times - existing entries are updated, missing ones inserted.
 */

import 'dotenv/config';
import { connectDB, disconnectDB } from '@config/db';
import { logger } from '@utils/logger';
import {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  type PermissionName,
} from '@constants/permissions.constants';
import { ALL_ROLES } from '@constants/roles.constants';

// Import via the central model barrel to guarantee Permission/Role/User are
// all registered with Mongoose in the correct order before any DB operation.
import { PermissionModel, RoleModel } from './auth.models';

const seedPermissions = async () => {
  logger.info('Seeding permissions...');
  const ops = ALL_PERMISSIONS.map((name) => ({
    updateOne: {
      filter: { name },
      update: {
        $set: {
          name,
          group: name.split('.')[0] ?? 'misc',
          description: `Auto-seeded permission: ${name}`,
        },
      },
      upsert: true,
    },
  }));
  if (ops.length > 0) await PermissionModel.bulkWrite(ops, { ordered: false });
  const total = await PermissionModel.countDocuments();
  logger.info(`Permissions ready: ${total}`);
};

const seedRoles = async () => {
  logger.info('Seeding roles...');

  // Build name -> _id map for permissions.
  const allPerms = await PermissionModel.find({}, { name: 1 }).lean();
  const nameToId = new Map(allPerms.map((p) => [String(p.name).toLowerCase(), p._id]));

  for (const roleName of ALL_ROLES) {
    const permNames = ROLE_PERMISSIONS[roleName];
    const permissionIds = permNames
      .map((n) => nameToId.get(n.toLowerCase()))
      .filter(Boolean);

    const missing = permNames.filter((n) => !nameToId.has(n.toLowerCase()));
    if (missing.length > 0) {
      logger.warn(`Role ${roleName} missing permission documents for: ${missing.join(', ')}`);
    }

    await RoleModel.updateOne(
      { name: roleName, isSystem: true, libraryId: null },
      {
        $set: {
          name: roleName,
          isSystem: true,
          libraryId: null,
          description: `Auto-seeded system role: ${roleName}`,
          permissions: permissionIds,
        },
      },
      { upsert: true },
    );
  }

  const total = await RoleModel.countDocuments({ isSystem: true });
  logger.info(`System roles ready: ${total}`);
  logger.info('Users must sign in again after RBAC seed so JWT permissions match updated roles.');
};

export const seedRbacCore = async (): Promise<void> => {
  await seedPermissions();
  await seedRoles();
};

const run = async () => {
  try {
    await connectDB();
    await seedRbacCore();
    logger.info('\u2705 RBAC seed completed successfully.');
  } catch (err) {
    logger.error('RBAC seed failed:', err);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
  }
};

// Run only when executed directly (not when imported).
const isDirect = require.main === module;
if (isDirect) {
  void run();
}

export { run as runRbacSeeder };
