import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { LibraryModel, BranchModel } from '@modules/library/library.models';
import { LIBRARY_STATUS, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { SeatModel } from '@modules/seats/seat.model';
import { libraryService } from '@modules/library/library.service';
import { seatService } from '@modules/seats/seat.service';
import { SUBSCRIPTION_RECORD_STATUS } from '@modules/subscription-billing/library-subscription.constants';
import {
  computeUsageStatus,
  subscriptionLimitService,
} from '@modules/subscription-billing/subscription-limit.service';
import { PLAN_LIMIT_ENTITY, USAGE_STATUS } from '@modules/subscription-billing/subscription-limit.constants';
import { buildLibrarySubscriptionSnapshot } from '@modules/subscription-billing/subscription-snapshot.builder';
import { ApiError } from '@utils/ApiError';

let mongo: MongoMemoryServer;

const ownerActor = (libraryId: string): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  role: ROLES.LIBRARY_OWNER,
  permissions: [
    PERMISSIONS.BRANCH_CREATE,
    PERMISSIONS.SEAT_CREATE,
    PERMISSIONS.SEAT_BULK_CREATE,
  ],
  libraryId,
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

async function seedBasicPlan(maxBranches = 1, maxSeats = 2) {
  return PlatformSubscriptionPlanModel.create({
    planKey: SUBSCRIPTION_PLAN.BASIC,
    displayName: 'Basic',
    maxStudents: 100,
    maxBranches,
    maxSeats,
    maxStaff: 5,
    storageLimitMb: 1024,
    featureFlags: {},
    monthlyPrice: 499,
    yearlyPrice: 4999,
    active: true,
    sortOrder: 0,
  });
}

async function seedLibrary(planId: mongoose.Types.ObjectId) {
  const lib = await LibraryModel.create({
    name: 'Limit Test Lib',
    slug: `lib-${crypto.randomBytes(4).toString('hex')}`,
    email: 'limits@test.com',
    status: LIBRARY_STATUS.ACTIVE,
    subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
  });
  await LibrarySubscriptionModel.create({
    libraryId: lib._id,
    planId,
    planCode: SUBSCRIPTION_PLAN.BASIC,
    planName: 'Basic',
    status: SUBSCRIPTION_RECORD_STATUS.ACTIVE,
    billingCycle: 'MONTHLY',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 86400000),
    dueAmount: 0,
    paidAmount: 0,
    amount: 0,
  });
  return lib;
}

describe('subscriptionLimitService', () => {
  it('computeUsageStatus: warning at 80%, over when above cap', () => {
    expect(computeUsageStatus(4, 5)).toBe(USAGE_STATUS.WARNING);
    expect(computeUsageStatus(5, 5)).toBe(USAGE_STATUS.WARNING);
    expect(computeUsageStatus(6, 5)).toBe(USAGE_STATUS.OVER_LIMIT);
    expect(computeUsageStatus(10, null)).toBe(USAGE_STATUS.NORMAL);
  });

  it('blocks branch creation at limit but keeps existing branches after downgrade', async () => {
    const plan = await seedBasicPlan(1, 10);
    const lib = await seedLibrary(plan._id as mongoose.Types.ObjectId);
    const libraryId = String(lib._id);

    await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Main',
      branchCode: 'MAIN',
      email: 'main@test.com',
      totalSeats: 10,
      active: true,
    });

    await expect(
      libraryService.createBranch(ownerActor(libraryId), libraryId, {
        branchName: 'Second',
        branchCode: 'SEC',
        email: 'sec@test.com',
        totalSeats: 10,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const branches = await BranchModel.countDocuments({ libraryId: lib._id });
    expect(branches).toBe(1);
  });

  it('blocks seat creation at capacity', async () => {
    const plan = await seedBasicPlan(5, 1);
    const lib = await seedLibrary(plan._id as mongoose.Types.ObjectId);
    const libraryId = String(lib._id);
    const branch = await BranchModel.create({
      libraryId: lib._id,
      branchName: 'Main',
      branchCode: 'MAIN',
      email: 'main@test.com',
      totalSeats: 10,
      active: true,
    });

    await SeatModel.create({
      libraryId: lib._id,
      branchId: branch._id,
      seatNumber: 'S1',
      floor: '1',
      zone: 'A',
      seatType: 'STANDARD',
      status: 'AVAILABLE',
      active: true,
      occupied: false,
      assignedStudentId: null,
    });

    await expect(
      seatService.createSeat(ownerActor(libraryId), {
        libraryId,
        branchId: String(branch._id),
        seatNumber: 'S2',
        floor: '1',
        zone: 'A',
        seatType: 'STANDARD',
        status: 'AVAILABLE',
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(await SeatModel.countDocuments({ libraryId: lib._id })).toBe(1);
  });

  it('enterprise plan bypasses limits', async () => {
    const ent = await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.ENTERPRISE,
      displayName: 'Enterprise',
      maxStudents: 10,
      maxBranches: 1,
      maxSeats: 1,
      maxStaff: 1,
      storageLimitMb: 100,
      featureFlags: {},
      monthlyPrice: 0,
      yearlyPrice: 0,
      active: true,
      sortOrder: 9,
    });
    const lib = await LibraryModel.create({
      name: 'Ent Lib',
      slug: `ent-${crypto.randomBytes(3).toString('hex')}`,
      email: 'ent@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.ENTERPRISE,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });
    await LibrarySubscriptionModel.create({
      libraryId: lib._id,
      planId: ent._id,
      planCode: SUBSCRIPTION_PLAN.ENTERPRISE,
      planName: 'Enterprise',
      status: SUBSCRIPTION_RECORD_STATUS.ACTIVE,
      billingCycle: 'YEARLY',
      startDate: new Date(),
      endDate: null,
      dueAmount: 0,
      paidAmount: 0,
      amount: 0,
    });

    await expect(
      subscriptionLimitService.validateLimitBeforeCreate(
        PLAN_LIMIT_ENTITY.BRANCHES,
        String(lib._id),
        { increment: 100 },
      ),
    ).resolves.toBeUndefined();

    const limits = await subscriptionLimitService.getLibraryPlanLimits(String(lib._id));
    expect(limits.unlimited).toBe(true);
    expect(limits.branchLimit).toBeNull();
  });

  it('snapshot exposes nested usage metrics with OVER_LIMIT', async () => {
    const plan = await seedBasicPlan(1, 50);
    const lib = await seedLibrary(plan._id as mongoose.Types.ObjectId);
    await BranchModel.create({
      libraryId: lib._id,
      branchName: 'B1',
      branchCode: 'B1',
      email: 'b1@test.com',
      totalSeats: 10,
      active: true,
    });
    await BranchModel.create({
      libraryId: lib._id,
      branchName: 'B2',
      branchCode: 'B2',
      email: 'b2@test.com',
      totalSeats: 10,
      active: true,
    });

    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.usage.branches.status).toBe(USAGE_STATUS.OVER_LIMIT);
    expect(snap.usageStatus).toBe(USAGE_STATUS.OVER_LIMIT);
    expect(snap.usage.branches.used).toBe(2);
    expect(snap.usage.branches.limit).toBe(1);
  });
});
