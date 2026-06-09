import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { DEFAULT_TIMEZONE, LIBRARY_STATUS, SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { RoleModel, UserModel } from '@modules/auth/auth.models';
import { StudentModel } from '@modules/students/students.models';
import { STUDENT_STATUS } from '@modules/students/student.constants';

import { NotificationModel } from './notification.model';
import { notificationsService } from './notifications.service';

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

function auth(
  id: string,
  role: (typeof ROLES)[keyof typeof ROLES],
  libraryId: string | null,
  branchId: string | null,
  permissions: string[],
): AuthenticatedUser {
  return { id, role, libraryId, branchId, permissions };
}

type Seed = {
  libraryId: string;
  branchId: string;
  ownerId: string;
  studentUserId: string;
  otherLibraryId: string;
  otherUserId: string;
};

async function seed(): Promise<Seed> {
  const suffix = crypto.randomBytes(6).toString('hex');
  const lib = await LibraryModel.create({
    name: `Notif Lib ${suffix}`,
    slug: `nf-${suffix}`,
    email: `nf-${suffix}@example.com`,
    timezone: DEFAULT_TIMEZONE,
    subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
    status: LIBRARY_STATUS.ACTIVE,
    settings: {},
  });
  const libraryId = String(lib._id);
  const br = await BranchModel.create({
    libraryId: lib._id,
    branchName: `Br ${suffix}`,
    branchCode: `NF${suffix.slice(0, 4)}`.toUpperCase(),
    email: `br-${suffix}@example.com`,
    totalSeats: 20,
    active: true,
  });
  const branchId = String(br._id);

  const ownerRole = await RoleModel.create({
    name: `OWNER_${suffix}`,
    permissions: [],
    isSystem: false,
    libraryId: lib._id,
  });
  const studentRole = await RoleModel.create({
    name: `STU_${suffix}`,
    permissions: [],
    isSystem: false,
    libraryId: lib._id,
  });

  const ownerId = new mongoose.Types.ObjectId().toString();
  const studentUserId = new mongoose.Types.ObjectId().toString();

  await UserModel.create({
    fullName: 'Owner',
    email: `owner-${suffix}@example.com`,
    passwordHash: await UserModel.hashPassword('Password123!'),
    role: ownerRole._id,
    libraryId: lib._id,
    branchId: null,
    isActive: true,
    isEmailVerified: true,
    refreshTokens: [],
    _id: new mongoose.Types.ObjectId(ownerId),
  } as never);

  await UserModel.create({
    fullName: 'Student User',
    email: `stu-${suffix}@example.com`,
    passwordHash: await UserModel.hashPassword('Password123!'),
    role: studentRole._id,
    libraryId: lib._id,
    branchId: br._id,
    isActive: true,
    isEmailVerified: true,
    refreshTokens: [],
    _id: new mongoose.Types.ObjectId(studentUserId),
  } as never);

  await StudentModel.create({
    libraryId: lib._id,
    branchId: br._id,
    studentId: `ST-${suffix}`,
    fullName: 'Student',
    email: `stu-rec-${suffix}@example.com`,
    admissionDate: new Date('2026-01-01'),
    membershipStartDate: new Date('2026-01-01'),
    status: STUDENT_STATUS.ACTIVE,
    userId: new mongoose.Types.ObjectId(studentUserId),
  });

  const lib2 = await LibraryModel.create({
    name: `Other ${suffix}`,
    slug: `ot-${suffix}`,
    email: `ot-${suffix}@example.com`,
    timezone: DEFAULT_TIMEZONE,
    subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
    status: LIBRARY_STATUS.ACTIVE,
    settings: {},
  });
  const otherRole = await RoleModel.create({
    name: `OTH_${suffix}`,
    permissions: [],
    isSystem: false,
    libraryId: lib2._id,
  });
  const otherUserId = new mongoose.Types.ObjectId().toString();
  await UserModel.create({
    fullName: 'Other',
    email: `other-${suffix}@example.com`,
    passwordHash: await UserModel.hashPassword('Password123!'),
    role: otherRole._id,
    libraryId: lib2._id,
    branchId: null,
    isActive: true,
    isEmailVerified: true,
    refreshTokens: [],
    _id: new mongoose.Types.ObjectId(otherUserId),
  } as never);

  return { libraryId, branchId, ownerId, studentUserId, otherLibraryId: String(lib2._id), otherUserId };
}

describe('notifications.service (integration)', { timeout: 20_000 }, () => {
  it('send + unread + mark read for recipient', async () => {
    const s = await seed();
    const ownerPerms = [PERMISSIONS.NOTIFICATION_SEND, PERMISSIONS.NOTIFICATION_READ];
    const owner = auth(s.ownerId, ROLES.LIBRARY_OWNER, s.libraryId, null, ownerPerms);
    const student = auth(s.studentUserId, ROLES.STUDENT, s.libraryId, s.branchId, [PERMISSIONS.NOTIFICATION_READ]);

    await notificationsService.send(owner, {
      title: 'Welcome',
      message: 'Test message',
      type: 'ANNOUNCEMENT',
      target: { mode: 'USER', userId: s.studentUserId },
    });

    const unread = await notificationsService.unreadCount(student);
    expect(unread.count).toBe(1);

    const list = await notificationsService.list(student, { page: 1, limit: 20 });
    expect(list.items).toHaveLength(1);
    const nid = list.items[0]._id;

    await notificationsService.markRead(student, nid);
    const unread2 = await notificationsService.unreadCount(student);
    expect(unread2.count).toBe(0);
  }, 15_000);

  it('mark all read', async () => {
    const s = await seed();
    const owner = auth(s.ownerId, ROLES.LIBRARY_OWNER, s.libraryId, null, [
      PERMISSIONS.NOTIFICATION_SEND,
      PERMISSIONS.NOTIFICATION_READ,
    ]);
    const student = auth(s.studentUserId, ROLES.STUDENT, s.libraryId, s.branchId, [PERMISSIONS.NOTIFICATION_READ]);

    await notificationsService.send(owner, {
      title: 'A',
      message: '1',
      type: 'ANNOUNCEMENT',
      target: { mode: 'USER', userId: s.studentUserId },
    });
    await notificationsService.send(owner, {
      title: 'B',
      message: '2',
      type: 'ANNOUNCEMENT',
      target: { mode: 'USER', userId: s.studentUserId },
    });

    const r = await notificationsService.markAllRead(student);
    expect(r.modified).toBeGreaterThanOrEqual(1);
    const unread = await notificationsService.unreadCount(student);
    expect(unread.count).toBe(0);
  }, 15_000);

  it('tenant isolation: cannot send to user in another library', async () => {
    const s = await seed();
    const owner = auth(s.ownerId, ROLES.LIBRARY_OWNER, s.libraryId, null, [PERMISSIONS.NOTIFICATION_SEND]);
    await expect(
      notificationsService.send(owner, {
        title: 'X',
        message: 'Y',
        type: 'ANNOUNCEMENT',
        target: { mode: 'USER', userId: s.otherUserId },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('accountant cannot use LIBRARY broadcast target', async () => {
    const s = await seed();
    const acct = auth(s.ownerId, ROLES.ACCOUNTANT, s.libraryId, null, [
      PERMISSIONS.NOTIFICATION_SEND,
      PERMISSIONS.PAYMENT_READ,
    ]);
    await expect(
      notificationsService.send(acct, {
        title: 'Due',
        message: 'Pay',
        type: 'PAYMENT_DUE',
        target: { mode: 'LIBRARY' },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('bulk send respects tenant recipients', async () => {
    const s = await seed();
    const owner = auth(s.ownerId, ROLES.LIBRARY_OWNER, s.libraryId, null, [
      PERMISSIONS.NOTIFICATION_SEND,
      PERMISSIONS.NOTIFICATION_READ,
    ]);
    const r = await notificationsService.bulkSend(owner, {
      items: [
        {
          title: 'Bulk',
          message: 'One',
          type: 'SYSTEM',
          target: { mode: 'USER', userId: s.studentUserId },
        },
      ],
    });
    expect(r.sent).toBe(1);
    const n = await NotificationModel.countDocuments({ recipientUserId: new mongoose.Types.ObjectId(s.studentUserId) });
    expect(n).toBe(1);
  });

  it('LIBRARY_OWNER can send library announcement', async () => {
    const s = await seed();
    const owner = auth(s.ownerId, ROLES.LIBRARY_OWNER, s.libraryId, null, [PERMISSIONS.NOTIFICATION_SEND]);
    const r = await notificationsService.send(owner, {
      title: 'Library notice',
      message: 'Hello everyone',
      type: 'ANNOUNCEMENT',
      target: { mode: 'LIBRARY' },
    });
    expect(r.sent).toBeGreaterThanOrEqual(1);
  });

  it('MANAGER can send branch notification', async () => {
    const s = await seed();
    const managerRole = await RoleModel.create({
      name: `MGR_${crypto.randomBytes(4).toString('hex')}`,
      permissions: [],
      isSystem: false,
      libraryId: new mongoose.Types.ObjectId(s.libraryId),
    });
    const managerId = new mongoose.Types.ObjectId().toString();
    await UserModel.create({
      fullName: 'Manager',
      email: `mgr-${crypto.randomBytes(4).toString('hex')}@example.com`,
      passwordHash: await UserModel.hashPassword('Password123!'),
      role: managerRole._id,
      libraryId: new mongoose.Types.ObjectId(s.libraryId),
      branchId: new mongoose.Types.ObjectId(s.branchId),
      isActive: true,
      isEmailVerified: true,
      refreshTokens: [],
      _id: new mongoose.Types.ObjectId(managerId),
    } as never);
    const manager = auth(managerId, ROLES.MANAGER, s.libraryId, s.branchId, [
      PERMISSIONS.NOTIFICATION_SEND,
    ]);
    const r = await notificationsService.send(manager, {
      title: 'Branch notice',
      message: 'Branch only',
      type: 'ANNOUNCEMENT',
      target: { mode: 'BRANCH', branchId: s.branchId },
    });
    expect(r.sent).toBeGreaterThanOrEqual(1);
  });

  it('non-permitted STUDENT cannot send notifications', async () => {
    const s = await seed();
    const student = auth(s.studentUserId, ROLES.STUDENT, s.libraryId, s.branchId, []);
    await expect(
      notificationsService.send(student, {
        title: 'X',
        message: 'Y',
        type: 'ANNOUNCEMENT',
        target: { mode: 'USER', userId: s.ownerId },
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('LIBRARY broadcast excludes sender by default (includeSelf false)', async () => {
    const s = await seed();
    const owner = auth(s.ownerId, ROLES.LIBRARY_OWNER, s.libraryId, null, [PERMISSIONS.NOTIFICATION_SEND]);

    await notificationsService.send(owner, {
      title: 'All-hands',
      message: 'Library-wide',
      type: 'ANNOUNCEMENT',
      target: { mode: 'LIBRARY' },
    });

    const ownerRows = await NotificationModel.countDocuments({
      recipientUserId: new mongoose.Types.ObjectId(s.ownerId),
    });
    const studentRows = await NotificationModel.countDocuments({
      recipientUserId: new mongoose.Types.ObjectId(s.studentUserId),
    });
    expect(ownerRows).toBe(0);
    expect(studentRows).toBe(1);
  });
});
