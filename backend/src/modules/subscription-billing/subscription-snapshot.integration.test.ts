import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { LibraryModel } from '@modules/library/library.models';
import {
  LIBRARY_STATUS,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_STATUS,
} from '@modules/library/library.constants';
import { PlatformSubscriptionPlanModel } from '@modules/platform/platform-subscription-plan.model';
import { PlatformSubscriptionInvoiceModel } from '@modules/subscription-billing/platform-subscription-invoice.model';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { librarySubscriptionService } from '@modules/subscription-billing/library-subscription.service';
import { buildLibrarySubscriptionSnapshot } from '@modules/subscription-billing/subscription-snapshot.builder';
import { platformService } from '@modules/platform/platform.service';
import { EXPIRY_STATE } from '@modules/subscription-billing/subscription-lifecycle.util';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';

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

async function seedPlan() {
  return PlatformSubscriptionPlanModel.create({
    planKey: SUBSCRIPTION_PLAN.BASIC,
    displayName: 'Basic',
    maxStudents: 100,
    maxBranches: 2,
    maxSeats: 50,
    maxStaff: 5,
    storageLimitMb: 100,
    featureFlags: { analytics: true },
    monthlyPrice: 999,
    yearlyPrice: 9999,
    active: true,
    sortOrder: 1,
  });
}

describe('buildLibrarySubscriptionSnapshot', () => {
  it('shows trial days remaining from trialEndsAt', async () => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 5);
    const lib = await LibraryModel.create({
      name: 'Trial Snap',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'trial@test.com',
      status: LIBRARY_STATUS.TRIAL,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.TRIALING,
      trialEndsAt: trialEnd,
    });

    await librarySubscriptionService.ensureFromLibrary(lib._id as mongoose.Types.ObjectId);

    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.isTrial).toBe(true);
    expect(snap.expiryState).toBe(EXPIRY_STATE.TRIAL);
    expect(snap.daysRemaining).toBeGreaterThanOrEqual(4);
    expect(snap.daysRemaining).toBeLessThanOrEqual(6);
    expect(snap.trialEndsAt).toBeTruthy();
  });

  it('reflects manual adjustment dates immediately', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Adjust Snap',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'adj@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    await librarySubscriptionService.ensureFromLibrary(lib._id as mongoose.Types.ObjectId);

    const end = new Date();
    end.setDate(end.getDate() + 30);

    await librarySubscriptionService.adjustSubscription(superActor(), String(lib._id), {
      planId: String(plan._id),
      endDate: end,
      adjustmentReason: 'Corrected contract end date',
    });

    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.subscriptionRecord?.manuallyAdjusted).toBe(true);
    expect(snap.daysRemaining).toBeGreaterThanOrEqual(29);
    expect(snap.daysRemaining).toBeLessThanOrEqual(31);
  });

  it('includes open invoice in financial snapshot', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Inv Snap',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'inv@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    await PlatformSubscriptionInvoiceModel.create({
      libraryId: lib._id,
      planId: plan._id,
      planCode: plan.planKey,
      planName: plan.displayName,
      billingCycle: 'MONTHLY',
      invoiceNumber: 'PSI-TEST-001',
      amount: 999,
      paidAmount: 200,
      dueAmount: 799,
      status: 'PARTIAL',
      issueDate: issue,
      dueDate: due,
      subscriptionStartDate: issue,
      subscriptionEndDate: due,
      paidAt: null,
      paymentMethod: null,
      transactionId: null,
      notes: null,
      createdBy: null,
      updatedBy: null,
    });

    await librarySubscriptionService.ensureFromLibrary(lib._id as mongoose.Types.ObjectId);

    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.financial.currentInvoice?.invoiceNumber).toBe('PSI-TEST-001');
    expect(snap.financial.currentInvoice?.amount).toBe(999);
    expect(snap.financial.currentInvoice?.paidAmount).toBe(200);
    expect(snap.financial.currentInvoice?.dueAmount).toBe(799);
    expect(snap.financial.currentInvoice?.status).toBe('PARTIAL');
  });

  it('reports usage counts from live aggregates', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Usage Snap',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'usage@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    await librarySubscriptionService.ensureFromLibrary(lib._id as mongoose.Types.ObjectId);

    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.usage.seatCapacity).toBe(50);
    expect(snap.usage.branchLimit).toBe(2);
    expect(snap.usage.staffLimit).toBe(5);
    expect(typeof snap.usage.seatsUsed).toBe('number');
  });

  it('uses planId over stale planCode in snapshot (no mixed displayName/code)', async () => {
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

    const lib = await LibraryModel.create({
      name: 'Enterprise Tenant',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'ent@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.GROWTH,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    await LibrarySubscriptionModel.create({
      libraryId: lib._id,
      planId: enterprise._id,
      planCode: SUBSCRIPTION_PLAN.GROWTH,
      planName: 'Growth',
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

    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.plan.id).toBe(String(enterprise._id));
    expect(snap.plan.code).toBe(SUBSCRIPTION_PLAN.ENTERPRISE);
    expect(snap.plan.displayName).toBe('Enterprise');
    expect(snap.subscription.planCode).toBe(SUBSCRIPTION_PLAN.ENTERPRISE);
    expect(snap.subscription.planName).toBe('Enterprise');
    expect(snap.featureAccess.planCode).toBe(SUBSCRIPTION_PLAN.ENTERPRISE);
    expect(snap.featureAccess.planName).toBe('Enterprise');

    const sub = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    expect(sub?.planCode).toBe(SUBSCRIPTION_PLAN.ENTERPRISE);
    expect(sub?.planName).toBe('Enterprise');
  });

  it('reflects catalog displayName edit in snapshot and keeps invoice snapshot', async () => {
    const plan = await PlatformSubscriptionPlanModel.create({
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

    const lib = await LibraryModel.create({
      name: 'Rename Snap',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'rename@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    await LibrarySubscriptionModel.create({
      libraryId: lib._id,
      planId: plan._id,
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

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    await PlatformSubscriptionInvoiceModel.create({
      libraryId: lib._id,
      planId: plan._id,
      planCode: SUBSCRIPTION_PLAN.BASIC,
      planName: 'Basic',
      billingCycle: 'MONTHLY',
      invoiceNumber: 'PSI-HIST-001',
      amount: 999,
      paidAmount: 0,
      dueAmount: 999,
      status: 'UNPAID',
      issueDate: issue,
      dueDate: due,
      subscriptionStartDate: issue,
      subscriptionEndDate: due,
      paidAt: null,
      paymentMethod: null,
      transactionId: null,
      notes: null,
      createdBy: null,
      updatedBy: null,
    });

    await platformService.patchPlan(superActor(), String(plan._id), {
      displayName: 'Basic Plus',
    });

    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.plan.displayName).toBe('Basic Plus');
    expect(snap.subscription.planName).toBe('Basic Plus');

    const invoice = await PlatformSubscriptionInvoiceModel.findOne({ invoiceNumber: 'PSI-HIST-001' }).lean();
    expect(invoice?.planCode).toBe(SUBSCRIPTION_PLAN.BASIC);
    expect(invoice?.planName).toBe('Basic');
  });

  it('sets expired days remaining to zero', async () => {
    const lib = await LibraryModel.create({
      name: 'Expired',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'exp@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
      subscriptionEndsAt: new Date(Date.now() - 10 * 86400000),
    });

    const sub = await librarySubscriptionService.ensureFromLibrary(lib._id as mongoose.Types.ObjectId);
    sub.status = 'EXPIRED';
    await sub.save();

    const snap = await buildLibrarySubscriptionSnapshot(String(lib._id));
    expect(snap.expiryState).toBe(EXPIRY_STATE.EXPIRED);
    expect(snap.daysRemaining).toBe(0);
  });
});
