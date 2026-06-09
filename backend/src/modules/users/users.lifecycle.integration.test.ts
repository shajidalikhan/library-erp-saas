import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { authService } from '@modules/auth/auth.service';
import { usersService } from '@modules/users/users.service';
import { USER_STATUS } from '@modules/users/users.constants';

let mongo: MongoMemoryServer;

const superActor = (): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  role: ROLES.SUPER_ADMIN,
  permissions: [PERMISSIONS.USER_READ, PERMISSIONS.USER_UPDATE, PERMISSIONS.USER_DELETE],
  libraryId: null,
  branchId: null,
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

afterEach(async () => {
  const cols = mongoose.connection.collections;
  for (const k of Object.keys(cols)) await cols[k].deleteMany({});
});

async function seedRole(name: string) {
  return RoleModel.create({
    name,
    description: name,
    permissions: [],
    isSystem: true,
    libraryId: null,
  });
}

describe('user lifecycle', () => {
  it('inactive user cannot login', async () => {
    const role = await seedRole(ROLES.MANAGER);
    const email = `inactive-${crypto.randomBytes(3).toString('hex')}@test.com`;
    await UserModel.create({
      fullName: 'Inactive User',
      email,
      passwordHash: await UserModel.hashPassword('Test123!'),
      role: role._id,
      libraryId: new mongoose.Types.ObjectId(),
      branchId: new mongoose.Types.ObjectId(),
      isActive: false,
      status: USER_STATUS.INACTIVE,
      isRootSuperAdmin: false,
      refreshTokens: [],
    });

    await expect(
      authService.login({ email, password: 'Test123!' }, { userAgent: null, ipAddress: null }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('root super admin cannot be deactivated or deleted', async () => {
    const role = await seedRole(ROLES.SUPER_ADMIN);
    const root = await UserModel.create({
      fullName: 'Root Admin',
      email: `root-${crypto.randomBytes(3).toString('hex')}@test.com`,
      passwordHash: await UserModel.hashPassword('Test123!'),
      role: role._id,
      libraryId: null,
      branchId: null,
      isActive: true,
      status: USER_STATUS.ACTIVE,
      isRootSuperAdmin: true,
      refreshTokens: [],
    });

    await expect(
      usersService.deactivateUser(superActor(), String(root._id)),
    ).rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('Root Super Admin') });

    await expect(
      usersService.deleteUser(superActor(), String(root._id)),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('super admin can search users by email', async () => {
    const role = await seedRole(ROLES.SUPER_ADMIN);
    const email = `findme-${crypto.randomBytes(3).toString('hex')}@test.com`;
    await UserModel.create({
      fullName: 'Find Me',
      email,
      passwordHash: await UserModel.hashPassword('Test123!'),
      role: role._id,
      libraryId: null,
      branchId: null,
      isActive: true,
      status: USER_STATUS.ACTIVE,
      refreshTokens: [],
    });

    const { items } = await usersService.listUsers(superActor(), {
      page: 1,
      limit: 20,
      search: email.split('@')[0],
      includeInactive: true,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(items.some((u) => String((u as { email?: string }).email) === email)).toBe(true);
  });
});
