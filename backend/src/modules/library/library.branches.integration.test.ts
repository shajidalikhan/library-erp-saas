import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { DEFAULT_TIMEZONE, LIBRARY_STATUS, SUBSCRIPTION_PLAN } from '@modules/library/library.constants';

import { libraryService } from './library.service';

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

function user(
  over: Partial<AuthenticatedUser> & Pick<AuthenticatedUser, 'id' | 'role'>,
): AuthenticatedUser {
  return {
    permissions: [PERMISSIONS.BRANCH_READ],
    libraryId: null,
    branchId: null,
    ...over,
  };
}

async function seedLibraries() {
  const suffix = crypto.randomBytes(6).toString('hex');
  const libA = await LibraryModel.create({
    name: `Lib A ${suffix}`,
    slug: `la-${suffix}`,
    email: `la-${suffix}@example.com`,
    timezone: DEFAULT_TIMEZONE,
    subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
    status: LIBRARY_STATUS.ACTIVE,
    settings: {},
  });
  const libB = await LibraryModel.create({
    name: `Lib B ${suffix}`,
    slug: `lb-${suffix}`,
    email: `lb-${suffix}@example.com`,
    timezone: DEFAULT_TIMEZONE,
    subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
    status: LIBRARY_STATUS.ACTIVE,
    settings: {},
  });
  const brA = await BranchModel.create({
    libraryId: libA._id,
    branchName: 'Main A',
    branchCode: `MA${suffix.slice(0, 4)}`.toUpperCase(),
    email: `bra-${suffix}@example.com`,
    totalSeats: 10,
    active: true,
  });
  const brB = await BranchModel.create({
    libraryId: libB._id,
    branchName: 'Main B',
    branchCode: `MB${suffix.slice(0, 4)}`.toUpperCase(),
    email: `brb-${suffix}@example.com`,
    totalSeats: 10,
    active: true,
  });
  return {
    libraryAId: String(libA._id),
    libraryBId: String(libB._id),
    branchAId: String(brA._id),
    branchBId: String(brB._id),
  };
}

describe('libraryService.listBranches (integration)', () => {
  it('LIBRARY_OWNER can list own branches', async () => {
    const s = await seedLibraries();
    const owner = user({
      id: 'owner-1',
      role: ROLES.LIBRARY_OWNER,
      libraryId: s.libraryAId,
      branchId: null,
      permissions: [PERMISSIONS.BRANCH_READ],
    });
    const { items } = await libraryService.listBranches(owner, s.libraryAId, {
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(items.length).toBe(1);
    expect(items[0].branchName).toBe('Main A');
  });

  it('LIBRARY_OWNER cannot list another library branches', async () => {
    const s = await seedLibraries();
    const owner = user({
      id: 'owner-1',
      role: ROLES.LIBRARY_OWNER,
      libraryId: s.libraryAId,
      branchId: null,
      permissions: [PERMISSIONS.BRANCH_READ],
    });
    await expect(
      libraryService.listBranches(owner, s.libraryBId, {
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('MANAGER can list only assigned branch', async () => {
    const s = await seedLibraries();
    const manager = user({
      id: 'mgr-1',
      role: ROLES.MANAGER,
      libraryId: s.libraryAId,
      branchId: s.branchAId,
      permissions: [PERMISSIONS.BRANCH_READ],
    });
    const { items } = await libraryService.listBranches(manager, s.libraryAId, {
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(items).toHaveLength(1);
    expect(String(items[0]._id)).toBe(s.branchAId);
  });

  it('SUPER_ADMIN can list any library branches', async () => {
    const s = await seedLibraries();
    const admin = user({
      id: 'sa-1',
      role: ROLES.SUPER_ADMIN,
      libraryId: null,
      branchId: null,
      permissions: [],
    });
    const { items } = await libraryService.listBranches(admin, s.libraryBId, {
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(items.length).toBe(1);
    expect(items[0].branchName).toBe('Main B');
  });
});
