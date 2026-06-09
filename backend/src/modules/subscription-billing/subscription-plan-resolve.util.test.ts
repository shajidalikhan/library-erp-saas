import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';

import { resolveSubscriptionPlan } from './subscription-plan-resolve.util';

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

describe('resolveSubscriptionPlan', () => {
  it('prefers planId over stale planCode', async () => {
    const enterprise = await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.ENTERPRISE,
      displayName: 'Enterprise',
      maxStudents: 1000,
      maxBranches: 10,
      maxSeats: 500,
      maxStaff: 50,
      storageLimitMb: 10240,
      monthlyPrice: 3999,
      yearlyPrice: 39999,
      active: true,
      sortOrder: 3,
      featureFlags: {},
    });

    await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.GROWTH,
      displayName: 'Growth',
      maxStudents: 300,
      maxBranches: 3,
      maxSeats: 150,
      maxStaff: 15,
      storageLimitMb: 3072,
      monthlyPrice: 1499,
      yearlyPrice: 14999,
      active: true,
      sortOrder: 1,
      featureFlags: {},
    });

    const resolved = await resolveSubscriptionPlan({
      planId: enterprise._id,
      planCode: SUBSCRIPTION_PLAN.GROWTH,
      planName: 'Growth',
    });

    expect(resolved.planId).toBe(String(enterprise._id));
    expect(resolved.code).toBe(SUBSCRIPTION_PLAN.ENTERPRISE);
    expect(resolved.displayName).toBe('Enterprise');
  });

  it('falls back to planCode only when planId is missing', async () => {
    const growth = await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.GROWTH,
      displayName: 'Growth',
      maxStudents: 300,
      maxBranches: 3,
      maxSeats: 150,
      maxStaff: 15,
      storageLimitMb: 3072,
      monthlyPrice: 1499,
      yearlyPrice: 14999,
      active: true,
      sortOrder: 1,
      featureFlags: {},
    });

    const resolved = await resolveSubscriptionPlan({
      planId: null,
      planCode: SUBSCRIPTION_PLAN.GROWTH,
      planName: 'Stale Name',
    });

    expect(resolved.planId).toBe(String(growth._id));
    expect(resolved.code).toBe(SUBSCRIPTION_PLAN.GROWTH);
    expect(resolved.displayName).toBe('Growth');
  });
});
