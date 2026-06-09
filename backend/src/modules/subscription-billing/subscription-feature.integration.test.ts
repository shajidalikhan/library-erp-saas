import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ApiError } from '@utils/ApiError';
import { LibraryModel } from '@modules/library/library.models';
import { LIBRARY_STATUS, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { SUBSCRIPTION_RECORD_STATUS } from '@modules/subscription-billing/library-subscription.constants';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';
import { defaultPlanFeatureFlags } from '@modules/subscription-billing/subscription-feature-catalog';
import { buildLibrarySubscriptionSnapshot } from '@modules/subscription-billing/subscription-snapshot.builder';

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

async function seedLibrary(planFlags: Record<string, boolean>) {
  const plan = await PlatformSubscriptionPlanModel.create({
    planKey: SUBSCRIPTION_PLAN.BASIC,
    displayName: 'Basic',
    maxStudents: 100,
    maxBranches: 1,
    maxSeats: 50,
    maxStaff: 5,
    storageLimitMb: 1024,
    featureFlags: { ...defaultPlanFeatureFlags(), ...planFlags },
    monthlyPrice: 499,
    yearlyPrice: 4999,
    active: true,
    sortOrder: 0,
  });
  const lib = await LibraryModel.create({
    name: 'Feat Lib',
    slug: `fl-${crypto.randomBytes(4).toString('hex')}`,
    email: 'feat@test.com',
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
  return lib;
}

describe('subscriptionFeatureService', () => {
  it('catalog includes public_booking default off on basic plan', async () => {
    const lib = await seedLibrary({});
    const effective = await subscriptionFeatureService.resolveEffectiveFeatures(String(lib._id));
    expect(effective.features.public_booking).toBe(false);
  });

  it('enabled override makes public_booking true in effective features and snapshot', async () => {
    const lib = await seedLibrary({ public_booking: false });
    const libraryId = String(lib._id);

    const effective = await subscriptionFeatureService.patchLibraryFeatureOverrides(
      new mongoose.Types.ObjectId().toString(),
      libraryId,
      {
        enabledFeaturesOverride: ['public_booking'],
        disabledFeaturesOverride: [],
        reason: 'Enable public booking for tenant',
      },
    );
    expect(effective.features.public_booking).toBe(true);
    expect(effective.enabledFeaturesOverride).toContain('public_booking');

    const snap = await buildLibrarySubscriptionSnapshot(libraryId);
    expect(snap.featureFlags.public_booking).toBe(true);
    expect(snap.featureAccess.features.public_booking).toBe(true);
  });

  it('super admin override enables feature for one library', async () => {
    const lib = await seedLibrary({ analytics: false, exports: false });
    const libraryId = String(lib._id);

    let effective = await subscriptionFeatureService.resolveEffectiveFeatures(libraryId);
    expect(effective.features.analytics).toBe(false);

    effective = await subscriptionFeatureService.patchLibraryFeatureOverrides(
      new mongoose.Types.ObjectId().toString(),
      libraryId,
      {
        enabledFeaturesOverride: ['analytics'],
        disabledFeaturesOverride: [],
        reason: 'Demo trial access',
      },
    );
    expect(effective.features.analytics).toBe(true);
    expect(effective.enabledFeaturesOverride).toContain('analytics');
  });

  it('disabled analytics blocks assertFeature', async () => {
    const lib = await seedLibrary({ analytics: false, reports: true });
    const libraryId = String(lib._id);

    await expect(subscriptionFeatureService.assertFeature(libraryId, 'analytics')).rejects.toBeInstanceOf(ApiError);
    await expect(subscriptionFeatureService.assertFeature(libraryId, 'analytics')).rejects.toMatchObject({
      statusCode: 403,
      details: expect.objectContaining({ feature: 'analytics', upgradeRequired: true }),
    });

    await expect(subscriptionFeatureService.assertFeature(libraryId, 'reports')).resolves.toBeUndefined();
  });

  it('disabled exports blocks export feature but reports remain available', async () => {
    const lib = await seedLibrary({ reports: true, exports: false });
    const libraryId = String(lib._id);

    await expect(subscriptionFeatureService.assertFeature(libraryId, 'exports')).rejects.toMatchObject({
      statusCode: 403,
      details: expect.objectContaining({ feature: 'exports' }),
    });
    await expect(subscriptionFeatureService.assertFeature(libraryId, 'reports')).resolves.toBeUndefined();
  });

  it('plan feature edit reflects in tenant snapshot', async () => {
    const lib = await seedLibrary({ qr_attendance: true, analytics: false });
    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.featureFlags.qr_attendance).toBe(true);
    expect(snap.featureFlags.analytics).toBe(false);
    expect(snap.featureAccess.included.some((f) => f.key === 'qr_attendance')).toBe(true);
  });

  it('legacy plan alias enables exports from reports_export', async () => {
    const plan = await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.BASIC,
      displayName: 'Legacy Basic',
      maxStudents: 10,
      maxBranches: 1,
      maxSeats: 10,
      maxStaff: 2,
      storageLimitMb: 100,
      featureFlags: { reports_export: true, exports: false },
      monthlyPrice: 0,
      yearlyPrice: 0,
      active: true,
      sortOrder: 99,
    });
    const lib = await LibraryModel.create({
      name: 'Legacy Lib',
      slug: `leg-${crypto.randomBytes(3).toString('hex')}`,
      email: 'leg@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });
    await LibrarySubscriptionModel.create({
      libraryId: lib._id,
      planId: plan._id,
      planCode: SUBSCRIPTION_PLAN.BASIC,
      planName: 'Legacy Basic',
      status: SUBSCRIPTION_RECORD_STATUS.ACTIVE,
      billingCycle: 'MONTHLY',
      startDate: new Date(),
      endDate: null,
      dueAmount: 0,
      paidAmount: 0,
      amount: 0,
    });

    const effective = await subscriptionFeatureService.resolveEffectiveFeatures(String(lib._id));
    expect(effective.features.exports).toBe(true);
  });
});
