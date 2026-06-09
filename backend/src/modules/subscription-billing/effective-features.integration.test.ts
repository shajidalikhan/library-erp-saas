import crypto from 'node:crypto';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { LibraryModel } from '@modules/library/library.models';
import { LIBRARY_STATUS, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { SUBSCRIPTION_RECORD_STATUS } from '@modules/subscription-billing/library-subscription.constants';
import { defaultPlanFeatureFlags } from '@modules/subscription-billing/subscription-feature-catalog';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';
import { subscriptionBillingService } from '@modules/subscription-billing/subscription-billing.service';

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

const ownerActor = (libraryId: string): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Owner',
  email: 'owner@test.com',
  role: ROLES.LIBRARY_OWNER,
  permissions: ['booking.read'],
  libraryId,
  branchId: null,
  studentId: null,
  isActive: true,
});

describe('GET /billing/effective-features (service)', () => {
  it('returns public_booking true when tenant override enabled', async () => {
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
      name: 'Nav Lib',
      slug: `nav-${crypto.randomBytes(4).toString('hex')}`,
      email: 'nav@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
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

    const libraryId = String(lib._id);
    await subscriptionFeatureService.patchLibraryFeatureOverrides(
      new mongoose.Types.ObjectId().toString(),
      libraryId,
      {
        enabledFeaturesOverride: ['public_booking'],
        disabledFeaturesOverride: [],
        reason: 'Enable public booking',
      },
    );

    const payload = await subscriptionBillingService.getTenantEffectiveFeatures(
      ownerActor(libraryId),
    );
    expect(payload.effectiveFeatures.public_booking).toBe(true);
    expect(payload.featureAccess.enabledFeaturesOverride).toContain('public_booking');
  });
});
