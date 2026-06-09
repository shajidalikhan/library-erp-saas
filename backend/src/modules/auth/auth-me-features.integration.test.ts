import crypto from 'node:crypto';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import { LibraryModel } from '@modules/library/library.models';
import { LIBRARY_STATUS, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { SUBSCRIPTION_RECORD_STATUS } from '@modules/subscription-billing/library-subscription.constants';
import { defaultPlanFeatureFlags } from '@modules/subscription-billing/subscription-feature-catalog';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';
import { seedRbacCore } from './auth.seeder';
import { RoleModel, UserModel } from './auth.models';
import { authService } from './auth.service';

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

describe('authService.getCurrentUser effective features', () => {
  it('includes public_booking true when tenant override is enabled', async () => {
    await seedRbacCore();

    const plan = await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.BASIC,
      displayName: 'Basic',
      maxStudents: 100,
      maxBranches: 1,
      maxSeats: 50,
      maxStaff: 5,
      storageLimitMb: 1024,
      featureFlags: { ...defaultPlanFeatureFlags(), public_booking: false },
      monthlyPrice: 499,
      yearlyPrice: 4999,
      active: true,
      sortOrder: 0,
    });

    const lib = await LibraryModel.create({
      name: 'Owner Lib',
      slug: `own-${crypto.randomBytes(4).toString('hex')}`,
      email: 'owner-lib@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      enabledFeaturesOverride: [],
      disabledFeaturesOverride: [],
    });

    await LibrarySubscriptionModel.create({
      libraryId: lib._id,
      planId: plan._id,
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

    await subscriptionFeatureService.patchLibraryFeatureOverrides(
      new mongoose.Types.ObjectId().toString(),
      String(lib._id),
      {
        enabledFeaturesOverride: ['public_booking'],
        disabledFeaturesOverride: [],
        reason: 'Tenant trial',
      },
    );

    const ownerRole = await RoleModel.findOne({
      name: ROLES.LIBRARY_OWNER,
      isSystem: true,
      libraryId: null,
    });
    const owner = await UserModel.create({
      fullName: 'Lib Owner',
      email: `owner-${crypto.randomBytes(3).toString('hex')}@test.com`,
      passwordHash: 'hash',
      role: ownerRole!._id,
      libraryId: lib._id,
      isActive: true,
      isEmailVerified: true,
    });

    const me = await authService.getCurrentUser(String(owner._id));
    expect(me.effectiveFeatures?.public_booking).toBe(true);
    expect(me.subscriptionFeatures?.public_booking).toBe(true);
    expect(me.roleCapabilities?.public_booking?.view).toBe(true);
  });
});
