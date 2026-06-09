import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { DEFAULT_TIMEZONE, LIBRARY_STATUS, SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { authService } from '@modules/auth/auth.service';

let mongo: MongoMemoryServer;

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
  for (const k of Object.keys(cols)) {
    await cols[k].deleteMany({});
  }
});

describe('tenant suspension (auth)', () => {
  it('blocks login for tenant user when library is suspended', async () => {
    const suffix = crypto.randomBytes(6).toString('hex');
    const lib = await LibraryModel.create({
      name: `Lib ${suffix}`,
      slug: `sus-${suffix}`,
      email: `lib-${suffix}@example.com`,
      timezone: DEFAULT_TIMEZONE,
      subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
      status: LIBRARY_STATUS.SUSPENDED,
      settings: {},
    });
    const stRole = await RoleModel.create({
      name: `STU_${suffix}`,
      permissions: [],
      isSystem: false,
      libraryId: lib._id,
    });
    const br = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Main',
      branchCode: `M${suffix.slice(0, 3)}`.toUpperCase(),
      email: `br-${suffix}@example.com`,
      totalSeats: 10,
      active: true,
    });
    const email = `stu-${suffix}@example.com`;
    await UserModel.create({
      fullName: 'Student',
      email,
      passwordHash: await UserModel.hashPassword('Password123!'),
      role: stRole._id,
      libraryId: lib._id,
      branchId: br._id,
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
    } as never);

    await expect(
      authService.login({ email, password: 'Password123!' }, { ipAddress: '127.0.0.1' }),
    ).rejects.toMatchObject({ code: 'TENANT_SUSPENDED' });
  });
});
