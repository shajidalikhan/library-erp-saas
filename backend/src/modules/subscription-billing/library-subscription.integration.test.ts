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
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { subscriptionBillingService } from '@modules/subscription-billing/subscription-billing.service';
import { librarySubscriptionService } from '@modules/subscription-billing/library-subscription.service';
import { SUBSCRIPTION_RECORD_STATUS } from '@modules/subscription-billing/library-subscription.constants';
import { AuditLogModel } from '@modules/platform/audit-log.model';
import { startOfDay } from '@modules/subscription-billing/subscription-billing.helpers';

let mongo: MongoMemoryServer;

const superActor = (): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  role: ROLES.SUPER_ADMIN,
  permissions: [],
  libraryId: null,
  branchId: null,
});

const ownerActor = (libraryId: string): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  role: ROLES.LIBRARY_OWNER,
  permissions: [],
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

async function seedPlan() {
  return PlatformSubscriptionPlanModel.create({
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

describe('library subscription source of truth', () => {
  it('trial upgraded to paid now activates immediately', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Trial Now',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'tn@test.com',
      status: LIBRARY_STATUS.TRIAL,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.TRIALING,
      trialEndsAt: new Date(Date.now() + 86400000 * 10),
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
      paidAmount: 999,
      startPaidNow: true,
    });

    const sub = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    expect(sub?.status).toBe(SUBSCRIPTION_RECORD_STATUS.ACTIVE);
    expect(sub?.upcomingPlanCode).toBeFalsy();

    const updated = await LibraryModel.findById(lib._id).lean();
    expect(updated?.status).toBe(LIBRARY_STATUS.ACTIVE);
    expect(updated?.trialEndsAt).toBeFalsy();
  });

  it('trial upgraded to paid after trial end stays TRIALING with upcoming plan', async () => {
    const plan = await seedPlan();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 10);
    const lib = await LibraryModel.create({
      name: 'Trial Later',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'tl@test.com',
      status: LIBRARY_STATUS.TRIAL,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.TRIALING,
      trialEndsAt: trialEnd,
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
      paidAmount: 999,
      startPaidAfterTrial: true,
    });

    const sub = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    expect(sub?.status).toBe(SUBSCRIPTION_RECORD_STATUS.TRIALING);
    expect(sub?.upcomingPlanCode).toBe(SUBSCRIPTION_PLAN.BASIC);
    expect(sub?.upcomingStartDate).toBeTruthy();

    const updated = await LibraryModel.findById(lib._id).lean();
    expect(updated?.status).toBe(LIBRARY_STATUS.TRIAL);
  });

  it('manual adjustment requires reason and creates audit log', async () => {
    const lib = await LibraryModel.create({
      name: 'Adjust',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'adj@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    await librarySubscriptionService.ensureFromLibrary(lib._id as mongoose.Types.ObjectId);

    await expect(
      librarySubscriptionService.adjustSubscription(superActor(), String(lib._id), {
        adjustmentReason: 'ab',
      }),
    ).rejects.toMatchObject({ statusCode: 422 });

    await librarySubscriptionService.adjustSubscription(superActor(), String(lib._id), {
      adjustmentReason: 'Corrected billing period per contract',
      dueAmount: 100,
    });

    const sub = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    expect(sub?.manuallyAdjusted).toBe(true);
    expect(sub?.dueAmount).toBe(100);

    const audit = await AuditLogModel.findOne({
      libraryId: lib._id,
      action: 'SUBSCRIPTION_ADJUST',
    }).lean();
    expect(audit?.metadata).toBeTruthy();
  });

  it('sync endpoint repairs subscription from paid invoice', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Sync',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'sync@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
      paidAmount: 999,
    });

    await LibrarySubscriptionModel.deleteMany({ libraryId: lib._id });

    const result = await librarySubscriptionService.syncSubscription(superActor(), String(lib._id));
    expect(result.subscription.planCode).toBe(SUBSCRIPTION_PLAN.BASIC);
    expect(result.subscription.status).toBe(SUBSCRIPTION_RECORD_STATUS.ACTIVE);
  });

  it('owner cannot adjust subscription', async () => {
    const lib = await LibraryModel.create({
      name: 'Owner',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'own@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    await expect(
      librarySubscriptionService.adjustSubscription(ownerActor(String(lib._id)), String(lib._id), {
        adjustmentReason: 'Should fail',
        dueAmount: 0,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('active plan with future paid invoice schedules upcoming without immediate switch', async () => {
    const basic = await seedPlan();
    const growth = await PlatformSubscriptionPlanModel.create({
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

    const currentEnd = new Date();
    currentEnd.setMonth(currentEnd.getMonth() + 1);
    const futureStart = new Date(currentEnd);
    futureStart.setDate(futureStart.getDate() + 1);
    const futureEnd = new Date(futureStart);
    futureEnd.setMonth(futureEnd.getMonth() + 1);

    const lib = await LibraryModel.create({
      name: 'Active Basic',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'ab@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionStartsAt: startOfDay(new Date()),
      subscriptionEndsAt: currentEnd,
    });

    await librarySubscriptionService.ensureFromLibrary(lib._id as mongoose.Types.ObjectId);
    const subBefore = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    await LibrarySubscriptionModel.updateOne(
      { libraryId: lib._id },
      {
        $set: {
          status: SUBSCRIPTION_RECORD_STATUS.ACTIVE,
          planCode: SUBSCRIPTION_PLAN.BASIC,
          endDate: currentEnd,
        },
      },
    );

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(growth._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
      paidAmount: 1999,
      subscriptionStartDate: futureStart,
      subscriptionEndDate: futureEnd,
    });

    const sub = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    expect(sub?.planCode).toBe(SUBSCRIPTION_PLAN.BASIC);
    expect(sub?.status).toBe(SUBSCRIPTION_RECORD_STATUS.ACTIVE);
    expect(sub?.upcomingPlanCode).toBe(SUBSCRIPTION_PLAN.GROWTH);
    expect(startOfDay(sub!.upcomingStartDate!).getTime()).toBe(startOfDay(futureStart).getTime());

    const updatedLib = await LibraryModel.findById(lib._id).lean();
    expect(updatedLib?.status).toBe(LIBRARY_STATUS.ACTIVE);
    expect(updatedLib?.subscriptionPlan).toBe(SUBSCRIPTION_PLAN.BASIC);

    await LibrarySubscriptionModel.updateOne(
      { libraryId: lib._id },
      { $set: { upcomingStartDate: startOfDay(new Date()) } },
    );
    await librarySubscriptionService.promoteScheduledIfDue(lib._id as mongoose.Types.ObjectId);

    const subAfter = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    expect(subAfter?.planCode).toBe(SUBSCRIPTION_PLAN.GROWTH);
    expect(subAfter?.upcomingPlanCode).toBeFalsy();
    expect(subAfter?.status).toBe(SUBSCRIPTION_RECORD_STATUS.ACTIVE);
  });

  it('manual adjustment changes subscription dates', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Dates',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'dates@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    await librarySubscriptionService.ensureFromLibrary(lib._id as mongoose.Types.ObjectId);

    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2027-06-01T12:00:00.000Z');

    await librarySubscriptionService.adjustSubscription(superActor(), String(lib._id), {
      planId: String(plan._id),
      startDate: start,
      endDate: end,
      adjustmentReason: 'Contract dates corrected by super admin',
    });

    const sub = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    expect(sub!.startDate.toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(sub!.endDate!.toISOString().slice(0, 10)).toBe('2027-06-01');
  });
});
