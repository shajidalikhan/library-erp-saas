import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { canonicalPermissionName, PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import { PermissionModel, RoleModel } from './auth.models';
import { seedRbacCore } from './auth.seeder';

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
  for (const k of Object.keys(cols)) await cols[k].deleteMany({});
});

describe('seedRbacCore', () => {
  it('assigns public booking permissions to library owner', async () => {
    await seedRbacCore();

    const ownerRole = await RoleModel.findOne({
      name: ROLES.LIBRARY_OWNER,
      isSystem: true,
      libraryId: null,
    })
      .populate('permissions', 'name')
      .lean();

    const names =
      (ownerRole?.permissions as { name: string }[] | undefined)?.map((p) =>
        canonicalPermissionName(p.name),
      ) ?? [];
    expect(names).toContain(PERMISSIONS.BOOKING_READ);
    expect(names).toContain(PERMISSIONS.BOOKING_UPDATE);
    expect(names).toContain(PERMISSIONS.BOOKING_MANAGE);
    expect(names).toContain(PERMISSIONS.PUBLIC_PAGE_READ);
    expect(names).toContain(PERMISSIONS.PUBLIC_PAGE_MANAGE);

    const managerRole = await RoleModel.findOne({
      name: ROLES.MANAGER,
      isSystem: true,
      libraryId: null,
    })
      .populate('permissions', 'name')
      .lean();
    const managerPerms =
      (managerRole?.permissions as { name: string }[] | undefined)?.map((p) =>
        canonicalPermissionName(p.name),
      ) ?? [];
    expect(managerPerms).toContain(PERMISSIONS.BOOKING_READ);
    expect(managerPerms).toContain(PERMISSIONS.BOOKING_UPDATE);
    expect(managerPerms).not.toContain(PERMISSIONS.BOOKING_MANAGE);
    expect(managerPerms).not.toContain(PERMISSIONS.PUBLIC_PAGE_MANAGE);

    const bookingCreate = await PermissionModel.findOne({ name: PERMISSIONS.BOOKING_CREATE }).lean();
    expect(bookingCreate).toBeTruthy();
  });
});
