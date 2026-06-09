import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { PlatformSettingModel } from '@modules/platform/platform-setting.model';
import { platformService } from '@modules/platform/platform.service';
import { NotificationModel } from '@modules/notifications/notification.model';
import { DEMO_REQUEST_STATUS } from '@modules/demo-requests/demo-request.constants';
import { DemoRequestModel } from '@modules/demo-requests/demo-request.model';
import { demoRequestService } from '@modules/demo-requests/demo-request.service';

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

const superAdminUser = (): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  role: ROLES.SUPER_ADMIN,
  permissions: [],
  libraryId: null,
  branchId: null,
  email: 'super@example.com',
  fullName: 'Super Admin',
});

describe('demo requests', () => {
  it(
    'creates a public demo request',
    async () => {
    await PlatformSettingModel.create({
      singletonKey: 'default',
      supportEmail: 'support@example.com',
      salesEmail: 'sales@example.com',
      demoRequestNotifyEmail: 'leads@example.com',
      maintenanceMode: false,
      featureFlags: {},
      impersonationEnabled: false,
      impersonationNotes: '',
    });
    const superRole = await RoleModel.create({
      name: ROLES.SUPER_ADMIN,
      permissions: [],
      isSystem: true,
      libraryId: null,
    });
    await UserModel.create({
      fullName: 'Super',
      email: `super-${crypto.randomBytes(3).toString('hex')}@example.com`,
      passwordHash: await UserModel.hashPassword('Password123!'),
      role: superRole._id,
      libraryId: null,
      branchId: null,
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
    } as never);

    const result = await demoRequestService.createPublic({
      fullName: 'Rohit Kumar',
      email: 'lead@example.com',
      phone: '+91 98765 43210',
      libraryName: 'City Study Hub',
      city: 'Jaipur',
      branchCount: 2,
      studentCount: 250,
      currentSystem: 'Excel',
      interestedFeatures: ['ATTENDANCE', 'PAYMENTS'],
      notes: 'Need onboarding next week',
      website: '',
    });

    const doc = await DemoRequestModel.findById(result.id).lean();
    expect(doc?.status).toBe(DEMO_REQUEST_STATUS.NEW);
    expect(doc?.interestedFeatures).toEqual(['ATTENDANCE', 'PAYMENTS']);

    const notifications = await NotificationModel.find({
      title: 'New demo request',
    }).lean();
    expect(notifications.length).toBeGreaterThan(0);
    },
    25_000,
  );

  it('rejects invalid payloads via model constraints', async () => {
    await expect(
      demoRequestService.createPublic({
        fullName: 'A',
        email: 'bad-email',
        phone: '123',
        libraryName: 'X',
        city: 'Y',
        branchCount: 0,
        studentCount: 0,
        currentSystem: '',
        interestedFeatures: [],
        notes: '',
        website: '',
      }),
    ).rejects.toBeTruthy();
  });

  it('lists and updates demo requests for super admins only', async () => {
    const created = await demoRequestService.createPublic({
      fullName: 'Owner',
      email: 'owner@example.com',
      phone: '9999999999',
      libraryName: 'North Library',
      city: 'Delhi',
      branchCount: 1,
      studentCount: 80,
      currentSystem: '',
      interestedFeatures: ['REPORTS'],
      notes: '',
      website: '',
    });

    const superRole = await RoleModel.create({
      name: ROLES.SUPER_ADMIN,
      permissions: [],
      isSystem: true,
      libraryId: null,
    });
    const assignee = await UserModel.create({
      fullName: 'Sales',
      email: `sales-${crypto.randomBytes(3).toString('hex')}@example.com`,
      passwordHash: await UserModel.hashPassword('Password123!'),
      role: superRole._id,
      libraryId: null,
      branchId: null,
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
    } as never);

    const list = await demoRequestService.listForPlatform(superAdminUser(), {
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
    expect(list.items.some((item) => item.id === created.id)).toBe(true);

    const updated = await demoRequestService.patchForPlatform(superAdminUser(), created.id, {
      status: DEMO_REQUEST_STATUS.CONTACTED,
      assignedTo: String(assignee._id),
      adminNote: 'Called and scheduled follow-up',
    });
    expect(updated.status).toBe(DEMO_REQUEST_STATUS.CONTACTED);
    expect(updated.assignedTo).toBe(String(assignee._id));
    expect(updated.adminNotes).toHaveLength(1);

    await expect(
      demoRequestService.listForPlatform(
        { ...superAdminUser(), role: ROLES.MANAGER },
        { page: 1, limit: 20, sortBy: 'createdAt', sortOrder: 'desc' },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('updates platform settings for super admins', async () => {
    const updated = await platformService.patchSettings(superAdminUser(), {
      supportEmail: 'support@example.com',
      salesEmail: 'sales@example.com',
      demoRequestNotifyEmail: 'leads@example.com',
    });
    expect(updated.demoRequestNotifyEmail).toBe('leads@example.com');
    expect(updated.salesEmail).toBe('sales@example.com');
  });
});
