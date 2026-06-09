import crypto from 'node:crypto';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '@/types/express';
import { SUBSCRIPTION_PLAN } from '@modules/library/library.constants';
import { LibraryModel } from '@modules/library/library.models';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { subscriptionLimitService } from '@modules/subscription-billing/subscription-limit.service';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';

import { SUBSCRIPTION_FEATURE_KEYS } from '@modules/subscription-billing/subscription-feature-catalog';

import { platformService } from './platform.service';

let mongo: MongoMemoryServer;

const superUser = (): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  fullName: 'Super',
  email: 'super@test.com',
  role: 'SUPER_ADMIN',
  permissions: [],
  libraryId: null,
  branchId: null,
  studentId: null,
  isActive: true,
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

describe('platform subscription plan catalog', () => {
  it('does not overwrite edited plan values on listPlans', async () => {
    const user = superUser();
    await platformService.listPlans(user);

    const basic = await PlatformSubscriptionPlanModel.findOne({ planKey: SUBSCRIPTION_PLAN.BASIC });
    expect(basic).toBeTruthy();

    await platformService.patchPlan(user, String(basic!._id), {
      monthlyPrice: 777,
      yearlyPrice: 7777,
      maxSeats: 100,
      displayName: 'Basic Plus',
    });

    await platformService.listPlans(user);
    const refreshed = await PlatformSubscriptionPlanModel.findById(basic!._id).lean();
    expect(refreshed?.monthlyPrice).toBe(777);
    expect(refreshed?.yearlyPrice).toBe(7777);
    expect(refreshed?.maxSeats).toBe(100);
    expect(refreshed?.displayName).toBe('Basic Plus');
  });

  it('persists active=false and feature flag false', async () => {
    const user = superUser();
    const listed = await platformService.listPlans(user);
    const growth = (listed.items as { _id: string; planKey: string }[]).find(
      (p) => p.planKey === SUBSCRIPTION_PLAN.GROWTH,
    );
    expect(growth).toBeTruthy();

    await platformService.patchPlan(user, growth!._id, {
      active: false,
      featureFlags: { exports: false, analytics: false },
    });

    const doc = await PlatformSubscriptionPlanModel.findById(growth!._id).lean();
    expect(doc?.active).toBe(false);
    expect(doc?.featureFlags?.exports).toBe(false);
    expect(doc?.featureFlags?.analytics).toBe(false);
  });

  it('allows limit fields to be set to zero', async () => {
    const user = superUser();
    const listed = await platformService.listPlans(user);
    const pro = (listed.items as { _id: string; planKey: string }[]).find(
      (p) => p.planKey === SUBSCRIPTION_PLAN.PROFESSIONAL,
    );

    await platformService.patchPlan(user, pro!._id, {
      maxStaff: 0,
      storageLimitMb: 0,
    });

    const doc = await PlatformSubscriptionPlanModel.findById(pro!._id).lean();
    expect(doc?.maxStaff).toBe(0);
    expect(doc?.storageLimitMb).toBe(0);
  });

  it('reflects updated limits for libraries on the plan', async () => {
    const user = superUser();
    await platformService.listPlans(user);
    const basic = await PlatformSubscriptionPlanModel.findOne({ planKey: SUBSCRIPTION_PLAN.BASIC }).lean();

    const library = await LibraryModel.create({
      name: 'Limit Sync Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'limits@test.com',
      status: 'ACTIVE',
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
    });

    await LibrarySubscriptionModel.create({
      libraryId: library._id,
      planId: basic!._id,
      planCode: SUBSCRIPTION_PLAN.BASIC,
      planName: 'Basic',
      billingCycle: 'MONTHLY',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: null,
      trialEndsAt: null,
      graceEndsAt: null,
      amount: 0,
      paidAmount: 0,
      dueAmount: 0,
      autoRenew: true,
      manuallyAdjusted: false,
    });

    await platformService.patchPlan(user, String(basic!._id), { maxSeats: 120 });

    const limits = await subscriptionLimitService.getLibraryPlanLimits(String(library._id));
    expect(limits.seatCapacity).toBe(120);
  });

  it('invoice pricing uses updated monthly price from catalog', async () => {
    const user = superUser();
    await platformService.listPlans(user);
    const basic = await PlatformSubscriptionPlanModel.findOne({ planKey: SUBSCRIPTION_PLAN.BASIC }).lean();
    await platformService.patchPlan(user, String(basic!._id), { monthlyPrice: 650 });

    const updated = await PlatformSubscriptionPlanModel.findById(basic!._id).lean();
    expect(updated?.monthlyPrice).toBe(650);
  });

  it('edit monthlyPrice from 499 to 599 persists and returns updated plan', async () => {
    const user = superUser();
    await platformService.listPlans(user);
    const basic = await PlatformSubscriptionPlanModel.findOne({ planKey: SUBSCRIPTION_PLAN.BASIC }).lean();
    expect(basic?.monthlyPrice).toBe(499);

    const updated = await platformService.patchPlan(user, String(basic!._id), { monthlyPrice: 599 });
    expect(updated.monthlyPrice).toBe(599);

    const fromDb = await PlatformSubscriptionPlanModel.findById(basic!._id).lean();
    expect(fromDb?.monthlyPrice).toBe(599);
  });

  it('sortOrder=0 persists', async () => {
    const user = superUser();
    await platformService.listPlans(user);
    const basic = await PlatformSubscriptionPlanModel.findOne({ planKey: SUBSCRIPTION_PLAN.BASIC }).lean();

    const updated = await platformService.patchPlan(user, String(basic!._id), { sortOrder: 0 });
    expect(updated.sortOrder).toBe(0);

    const fromDb = await PlatformSubscriptionPlanModel.findById(basic!._id).lean();
    expect(fromDb?.sortOrder).toBe(0);
  });

  it('unchecked catalog feature flag persists as disabled when sent in PATCH', async () => {
    const user = superUser();
    await platformService.listPlans(user);
    const growth = await PlatformSubscriptionPlanModel.findOne({ planKey: SUBSCRIPTION_PLAN.GROWTH }).lean();
    expect(growth?.featureFlags?.exports).toBe(true);

    const fullFlags = Object.fromEntries(
      SUBSCRIPTION_FEATURE_KEYS.map((key) => [key, key === 'exports' ? false : Boolean(growth?.featureFlags?.[key])]),
    ) as Record<string, boolean>;

    const updated = await platformService.patchPlan(user, String(growth!._id), {
      featureFlags: fullFlags,
    });
    expect(updated.featureFlags?.exports).toBe(false);

    const fromDb = await PlatformSubscriptionPlanModel.findById(growth!._id).lean();
    expect(fromDb?.featureFlags?.exports).toBe(false);
    expect(fromDb?.featureFlags?.analytics).toBe(true);
  });

  it('repairs title-case planKey so code differs from display name', async () => {
    const user = superUser();
    await PlatformSubscriptionPlanModel.create({
      planKey: 'Professional',
      displayName: 'Professional',
      maxStudents: 100,
      maxBranches: 1,
      maxSeats: 50,
      maxStaff: 5,
      storageLimitMb: 1024,
      monthlyPrice: 3999,
      yearlyPrice: 39999,
      active: true,
      publicVisible: true,
      sortOrder: 2,
      featureFlags: {},
    });

    const listed = await platformService.listPlans(user);
    const pro = (listed.items as { planKey: string; displayName: string }[]).find(
      (p) => p.displayName === 'Professional',
    );
    expect(pro?.planKey).toBe(SUBSCRIPTION_PLAN.PROFESSIONAL);

    const fromDb = await PlatformSubscriptionPlanModel.findOne({ displayName: 'Professional' }).lean();
    expect(fromDb?.planKey).toBe(SUBSCRIPTION_PLAN.PROFESSIONAL);
  });

  it('does not reset STARTER active status on listPlans', async () => {
    const user = superUser();
    const starter = await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.STARTER,
      displayName: 'Starter',
      maxStudents: 50,
      maxBranches: 1,
      maxSeats: 25,
      maxStaff: 3,
      storageLimitMb: 512,
      monthlyPrice: 299,
      yearlyPrice: 2999,
      active: true,
      publicVisible: true,
      sortOrder: 98,
      featureFlags: {},
    });

    await platformService.listPlans(user);

    const fromDb = await PlatformSubscriptionPlanModel.findById(starter._id).lean();
    expect(fromDb?.active).toBe(true);
    expect(fromDb?.publicVisible).toBe(true);
  });

  it('Super Admin can change plan code FREE to STARTER and libraries stay linked by planId', async () => {
    const user = superUser();
    const freePlan = await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.FREE,
      displayName: 'Starter',
      maxStudents: 25,
      maxBranches: 1,
      maxSeats: 25,
      maxStaff: 2,
      storageLimitMb: 512,
      monthlyPrice: 0,
      yearlyPrice: 0,
      active: true,
      publicVisible: false,
      sortOrder: 98,
      featureFlags: {},
    });

    const library = await LibraryModel.create({
      name: 'Legacy Free Lib',
      slug: `free-lib-${crypto.randomBytes(3).toString('hex')}`,
      email: `free-${crypto.randomBytes(3).toString('hex')}@test.com`,
      subscriptionPlan: SUBSCRIPTION_PLAN.FREE,
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
    });

    await LibrarySubscriptionModel.create({
      libraryId: library._id,
      planId: freePlan._id,
      planCode: SUBSCRIPTION_PLAN.FREE,
      planName: 'Starter',
      billingCycle: 'MONTHLY',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: null,
      trialEndsAt: null,
      graceEndsAt: null,
      amount: 0,
      paidAmount: 0,
      dueAmount: 0,
      autoRenew: true,
      manuallyAdjusted: false,
    });

    const updated = await platformService.patchPlan(user, String(freePlan._id), {
      planKey: SUBSCRIPTION_PLAN.STARTER,
      displayName: 'Starter',
    });

    expect(updated.planKey).toBe(SUBSCRIPTION_PLAN.STARTER);

    const fromDb = await PlatformSubscriptionPlanModel.findById(freePlan._id).lean();
    expect(fromDb?.planKey).toBe(SUBSCRIPTION_PLAN.STARTER);

    const sub = await LibrarySubscriptionModel.findOne({ libraryId: library._id }).lean();
    expect(String(sub?.planId)).toBe(String(freePlan._id));
    expect(sub?.planCode).toBe(SUBSCRIPTION_PLAN.STARTER);

    const lib = await LibraryModel.findById(library._id).lean();
    expect(lib?.subscriptionPlan).toBe(SUBSCRIPTION_PLAN.STARTER);

    await platformService.listPlans(user);
    const recreatedFree = await PlatformSubscriptionPlanModel.findOne({
      planKey: SUBSCRIPTION_PLAN.FREE,
    }).lean();
    expect(recreatedFree).toBeNull();
  });

  it('rejects duplicate plan code on patch', async () => {
    const user = superUser();
    await platformService.listPlans(user);

    const freePlan = await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.FREE,
      displayName: 'Free',
      maxStudents: 10,
      maxBranches: 1,
      maxSeats: 10,
      maxStaff: 1,
      storageLimitMb: 256,
      monthlyPrice: 0,
      yearlyPrice: 0,
      active: false,
      publicVisible: false,
      sortOrder: 99,
      featureFlags: {},
    });

    const basic = await PlatformSubscriptionPlanModel.findOne({ planKey: SUBSCRIPTION_PLAN.BASIC });
    expect(basic).toBeTruthy();

    await expect(
      platformService.patchPlan(user, String(freePlan._id), { planKey: SUBSCRIPTION_PLAN.BASIC }),
    ).rejects.toThrow(/already exists/i);
  });

  it('rejects invalid plan code on patch', async () => {
    const user = superUser();
    const listed = await platformService.listPlans(user);
    const growth = (listed.items as { _id: string }[])[0];
    expect(growth).toBeTruthy();

    await expect(
      platformService.patchPlan(user, growth._id, { planKey: '!' }),
    ).rejects.toThrow(/invalid plan key/i);
  });

  it('listPublicPlans returns active public tiers and not legacy STARTER override', async () => {
    const user = superUser();
    await platformService.listPlans(user);

    await PlatformSubscriptionPlanModel.create({
      planKey: SUBSCRIPTION_PLAN.STARTER,
      displayName: 'Stale Starter',
      maxStudents: 1,
      maxBranches: 1,
      maxSeats: 1,
      maxStaff: 1,
      storageLimitMb: 1,
      monthlyPrice: 1,
      yearlyPrice: 1,
      active: false,
      publicVisible: false,
      sortOrder: 99,
      featureFlags: {},
    });

    const publicPlans = await platformService.listPublicPlans();
    const keys = publicPlans.items.map((p) => p.planKey);
    expect(keys).toContain(SUBSCRIPTION_PLAN.BASIC);
    expect(keys).not.toContain(SUBSCRIPTION_PLAN.STARTER);
  });
});
