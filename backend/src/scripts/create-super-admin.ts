/**
 * Super Admin bootstrap
 * =====================
 * Idempotently ensures the platform default super-admin account exists.
 *
 * Prerequisites:
 *   - `MONGODB_URI` / `MONGODB_DB_NAME` in `.env`
 *   - System roles seeded: `npm run seed:rbac`
 *
 * Run:
 *   npm run create:superadmin
 */

import 'dotenv/config';
import { Types } from 'mongoose';
import { connectDB, disconnectDB } from '@config/db';
import { ROLES } from '@constants/roles.constants';
import { RoleModel, UserModel } from '@modules/auth/auth.models';

const BOOTSTRAP = {
  fullName: 'Super Admin',
  email: 'admin@libraryerp.com',
  password: 'Admin123',
} as const;

function getPopulatedRoleName(
  role: unknown,
): string | undefined {
  if (role && typeof role === 'object' && 'name' in role) {
    const n = (role as { name: unknown }).name;
    if (typeof n === 'string') return n;
  }
  return undefined;
}

const run = async (): Promise<void> => {
  const log = (msg: string) => console.log(`[create-super-admin] ${msg}`);
  const warn = (msg: string) => console.warn(`[create-super-admin] ${msg}`);
  const err = (msg: string) => console.error(`[create-super-admin] ${msg}`);

  log('Starting bootstrap…');

  try {
    await connectDB();

    const superAdminRole = await RoleModel.findOne({
      name: ROLES.SUPER_ADMIN,
      isSystem: true,
      libraryId: null,
    }).lean();

    if (!superAdminRole) {
      err('SUPER_ADMIN system role not found in the database.');
      err('Run `npm run seed:rbac` first, then re-run this script.');
      process.exitCode = 1;
      return;
    }

    const email = BOOTSTRAP.email.trim().toLowerCase();

    const existing = await UserModel.findOne({ email })
      .populate<{ name: string }>('role', 'name')
      .lean();

    if (existing) {
      const roleName = getPopulatedRoleName(existing.role);
      const isSuper =
        roleName === ROLES.SUPER_ADMIN &&
        (existing.libraryId === null || existing.libraryId === undefined) &&
        (existing.branchId === null || existing.branchId === undefined);

      if (isSuper) {
        await UserModel.updateOne(
          { _id: existing._id },
          { $set: { isRootSuperAdmin: true, status: 'ACTIVE', isActive: true } },
        );
        log(`Super admin already exists for email "${email}". Root flag ensured.`);
        log('If you forgot the password, reset it via your security process or update the document in MongoDB.');
        return;
      }

      err(`A user with email "${email}" already exists with role "${roleName ?? 'unknown'}".`);
      err('Refusing to overwrite. Use a different email or remove/rename the existing user first.');
      process.exitCode = 1;
      return;
    }

    const passwordHash = await UserModel.hashPassword(BOOTSTRAP.password);

    await UserModel.create({
      fullName: BOOTSTRAP.fullName,
      email,
      passwordHash,
      role: superAdminRole._id as Types.ObjectId,
      libraryId: null,
      branchId: null,
      isActive: true,
      status: 'ACTIVE',
      isRootSuperAdmin: true,
      isEmailVerified: true,
      refreshTokens: [],
    });

    log('Super admin user created successfully.');
    log(`  Email:    ${email}`);
    log(`  Full name: ${BOOTSTRAP.fullName}`);
    log(`  Role:     ${ROLES.SUPER_ADMIN}`);
    warn('Change the default password immediately after first login in production.');
  } catch (e) {
    console.error('[create-super-admin] Fatal error:', e);
    process.exitCode = 1;
  } finally {
    await disconnectDB();
    log('Database connection closed.');
  }
};

const isDirect = require.main === module;
if (isDirect) {
  void run();
}

export { run as runCreateSuperAdmin };
