import crypto from 'node:crypto';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@constants/permissions.constants';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { LibraryModel } from '@modules/library/library.models';
import { LIBRARY_STATUS, SUBSCRIPTION_PLAN, SUBSCRIPTION_STATUS } from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { SUBSCRIPTION_RECORD_STATUS } from '@modules/subscription-billing/library-subscription.constants';
import { defaultPlanFeatureFlags } from '@modules/subscription-billing/subscription-feature-catalog';
import { subscriptionFeatureService } from '@modules/subscription-billing/subscription-feature.service';
import { evaluateCapabilityAccess } from '@/services/capability-enforcement.service';
import { PUBLIC_BOOKING_ACCESS_MESSAGES } from '@constants/public-booking-access.constants';

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

async function seedLibrary(publicBookingEnabled: boolean) {
  const plan = await PlatformSubscriptionPlanModel.create({
    planKey: SUBSCRIPTION_PLAN.BASIC,
    displayName: 'Basic',
    maxStudents: 100,
    maxBranches: 1,
    maxSeats: 50,
    maxStaff: 5,
    storageLimitMb: 1024,
    featureFlags: { ...defaultPlanFeatureFlags(), public_booking: publicBookingEnabled },
    monthlyPrice: 499,
    yearlyPrice: 4999,
    active: true,
    sortOrder: 0,
  });
  const lib = await LibraryModel.create({
    name: 'PB Lib',
    slug: `pb-${crypto.randomBytes(4).toString('hex')}`,
    email: 'pb@test.com',
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

const ownerUser = (libraryId: string): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Owner',
  email: 'owner@test.com',
  role: ROLES.LIBRARY_OWNER,
  permissions: [
    PERMISSIONS.BOOKING_READ,
    PERMISSIONS.BOOKING_UPDATE,
    PERMISSIONS.BOOKING_MANAGE,
    PERMISSIONS.PUBLIC_PAGE_MANAGE,
  ],
  libraryId,
  branchId: null,
  studentId: null,
  isActive: true,
});

describe('public booking access enforcement', () => {
  it('blocks library owner when public_booking subscription feature is disabled', async () => {
    const lib = await seedLibrary(false);
    const libraryId = String(lib._id);
    const user = ownerUser(libraryId);

    const result = await evaluateCapabilityAccess(user, {
      module: 'public_booking',
      action: 'view',
      libraryId,
    });

    expect(result.allowed).toBe(false);
    expect(result.source).toBe('subscription');
    expect(result.reason).toBe(PUBLIC_BOOKING_ACCESS_MESSAGES.subscription);
  });

  it('allows library owner when public_booking subscription feature is enabled', async () => {
    const lib = await seedLibrary(true);
    const libraryId = String(lib._id);

    const result = await evaluateCapabilityAccess(ownerUser(libraryId), {
      module: 'public_booking',
      action: 'view',
      libraryId,
    });

    expect(result.allowed).toBe(true);
  });

  it('super admin can enable public_booking on a plan via feature flags', async () => {
    const lib = await seedLibrary(false);
    const libraryId = String(lib._id);

    let effective = await subscriptionFeatureService.resolveEffectiveFeatures(libraryId);
    expect(effective.features.public_booking).toBe(false);

    await PlatformSubscriptionPlanModel.updateOne(
      { planKey: SUBSCRIPTION_PLAN.BASIC },
      { $set: { 'featureFlags.public_booking': true } },
    );

    effective = await subscriptionFeatureService.resolveEffectiveFeatures(libraryId);
    expect(effective.features.public_booking).toBe(true);
  });
});
