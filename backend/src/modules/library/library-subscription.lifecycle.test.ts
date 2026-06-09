import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { LibraryModel } from '@modules/library/library.models';
import {
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { PlatformSettingModel } from '@modules/platform/platform-setting.model';
import { EXPIRY_STATE } from '@modules/subscription-billing/subscription-lifecycle.util';
import { subscriptionBillingService } from '@modules/subscription-billing/subscription-billing.service';
import { libraryService } from './library.service';

let mongo: MongoMemoryServer;

const superActor = (): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  role: ROLES.SUPER_ADMIN,
  permissions: [],
  libraryId: null,
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

async function seedPlans() {
  await PlatformSettingModel.create({
    singletonKey: 'default',
    defaultTrialDays: 14,
    supportEmail: 'support@test.com',
    salesEmail: 'sales@test.com',
    demoRequestNotifyEmail: '',
    maintenanceMode: false,
    featureFlags: {},
    impersonationEnabled: false,
    impersonationNotes: '',
  });
  await PlatformSubscriptionPlanModel.create({
    planKey: SUBSCRIPTION_PLAN.BASIC,
    displayName: 'Basic',
    maxStudents: 100,
    maxBranches: 2,
    maxSeats: 50,
    maxStaff: 5,
    storageLimitMb: 100,
    featureFlags: {},
    monthlyPrice: 999,
    yearlyPrice: 9999,
    active: true,
    sortOrder: 1,
  });
}

describe('library subscription lifecycle', () => {
  it('creating library with trial sets trialEndsAt and subscription details', async () => {
    await seedPlans();
    const start = new Date();
    const created = await libraryService.createLibrary(superActor(), {
      name: 'Trial Lib',
      email: `trial-${crypto.randomBytes(3).toString('hex')}@test.com`,
      subscription: {
        planType: 'TRIAL',
        billingCycle: 'TRIAL',
        subscriptionStartDate: start,
        trialDays: 10,
        createInvoice: false,
      },
    });

    const sub = created.subscription as {
      planName: string;
      expiryState: string;
      trialEndsAt: string;
      daysRemaining: number;
    };
    expect(sub.planName).toBe('Trial');
    expect(sub.expiryState).toBe(EXPIRY_STATE.TRIAL);

    const doc = await LibraryModel.findById(created._id).lean();
    expect(doc?.status).toBe(LIBRARY_STATUS.TRIAL);
    expect(doc?.trialEndsAt).toBeTruthy();
    expect(doc?.billingCycle).toBe('TRIAL');
  });

  it('creating library with paid plan sets start/end dates', async () => {
    await seedPlans();
    await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.GROWTH,
      displayName: 'Growth',
      maxStudents: 200,
      maxBranches: 5,
      maxSeats: 100,
      maxStaff: 10,
      storageLimitMb: 200,
      featureFlags: {},
      monthlyPrice: 1999,
      yearlyPrice: 19999,
      active: true,
      sortOrder: 2,
    });

    const start = new Date();
    const created = await libraryService.createLibrary(superActor(), {
      name: 'Paid Lib',
      email: `paid-${crypto.randomBytes(3).toString('hex')}@test.com`,
      subscription: {
        planType: 'GROWTH',
        billingCycle: 'MONTHLY',
        subscriptionStartDate: start,
        createInvoice: false,
      },
    });

    const sub = created.subscription as { planCode: string; endDate: string; expiryState: string };
    expect(sub.planCode).toBe(SUBSCRIPTION_PLAN.GROWTH);
    expect(sub.endDate).toBeTruthy();
    expect(sub.expiryState).toBe(EXPIRY_STATE.ACTIVE);

    const doc = await LibraryModel.findById(created._id).lean();
    expect(doc?.status).toBe(LIBRARY_STATUS.ACTIVE);
    expect(doc?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(doc?.subscriptionStartsAt).toBeTruthy();
    expect(doc?.subscriptionEndsAt).toBeTruthy();
  });

  it('detects expiring soon badge state', async () => {
    await seedPlans();
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 2);

    const lib = await LibraryModel.create({
      name: 'Soon',
      slug: `soon-${crypto.randomBytes(3).toString('hex')}`,
      email: 'soon@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionStartsAt: start,
      subscriptionEndsAt: end,
      billingCycle: 'MONTHLY',
      trialEndsAt: null,
    });

    const [enriched] = await subscriptionBillingService.enrichLibrariesWithSubscription([
      { ...JSON.parse(JSON.stringify(lib)), _id: String(lib._id) },
    ]);
    expect((enriched.subscription as { expiryState: string }).expiryState).toBe(
      EXPIRY_STATE.EXPIRING_SOON,
    );
    expect((enriched.subscription as { badgeLabel: string }).badgeLabel).toContain('Expires in');
  });

  it('detects grace period state', async () => {
    await seedPlans();
    const start = new Date();
    start.setDate(start.getDate() - 40);
    const end = new Date();
    end.setDate(end.getDate() - 1);

    const lib = await LibraryModel.create({
      name: 'Grace',
      slug: `grace-${crypto.randomBytes(3).toString('hex')}`,
      email: 'grace@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionStartsAt: start,
      subscriptionEndsAt: end,
      billingCycle: 'MONTHLY',
      trialEndsAt: null,
    });

    const [enriched] = await subscriptionBillingService.enrichLibrariesWithSubscription([
      { ...JSON.parse(JSON.stringify(lib)), _id: String(lib._id) },
    ]);
    expect((enriched.subscription as { expiryState: string }).expiryState).toBe(
      EXPIRY_STATE.GRACE_PERIOD,
    );
  });

  it('detects suspended state', async () => {
    await seedPlans();
    const lib = await LibraryModel.create({
      name: 'Sus',
      slug: `sus-${crypto.randomBytes(3).toString('hex')}`,
      email: 'sus@test.com',
      status: LIBRARY_STATUS.SUSPENDED,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
      subscriptionStartsAt: new Date(),
      subscriptionEndsAt: new Date(),
      billingCycle: 'MONTHLY',
      suspendedAt: new Date(),
      suspensionReason: 'Overdue',
    });

    const [enriched] = await subscriptionBillingService.enrichLibrariesWithSubscription([
      { ...JSON.parse(JSON.stringify(lib)), _id: String(lib._id) },
    ]);
    expect((enriched.subscription as { expiryState: string }).expiryState).toBe(
      EXPIRY_STATE.SUSPENDED,
    );
  });
});
