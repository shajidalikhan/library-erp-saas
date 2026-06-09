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
import { PlatformSubscriptionInvoiceModel } from '@modules/subscription-billing/platform-subscription-invoice.model';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { subscriptionBillingService } from '@modules/subscription-billing/subscription-billing.service';
import { PLATFORM_SUBSCRIPTION_INVOICE_STATUS } from '@modules/subscription-billing/subscription-billing.constants';
import { createPlatformSubscriptionInvoiceBodySchema } from '@modules/subscription-billing/subscription-billing.validation';

let mongo: MongoMemoryServer;

const superActor = (): AuthenticatedUser => ({
  id: new mongoose.Types.ObjectId().toString(),
  role: ROLES.SUPER_ADMIN,
  permissions: [],
  libraryId: null,
  branchId: null,
});

const ownerActor = (libraryId: string, userId: string): AuthenticatedUser => ({
  id: userId,
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
    featureFlags: { analytics: true },
    monthlyPrice: 999,
    yearlyPrice: 9999,
    active: true,
    sortOrder: 1,
  });
}

describe('platform subscription billing', () => {
  it('creates a subscription invoice with plan amount', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Test Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'lib@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const inv = await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
    });

    expect(inv.amount).toBe(999);
    expect(inv.paidAmount).toBe(0);
    expect(inv.dueAmount).toBe(999);
    expect(inv.status).toBe(PLATFORM_SUBSCRIPTION_INVOICE_STATUS.UNPAID);
  });

  it('records partial payment and keeps open status', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Test Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'lib@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const created = await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
    });

    const after = await subscriptionBillingService.collectPlatformInvoice(superActor(), created.id, {
      amount: 400,
    });

    expect(after.paidAmount).toBe(400);
    expect(after.dueAmount).toBe(599);
    expect(after.status).toBe(PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL);
  });

  it('full payment activates a suspended library', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Suspended Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'sus@test.com',
      status: LIBRARY_STATUS.SUSPENDED,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
      suspendedAt: new Date(),
      suspensionReason: 'Past due',
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const created = await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
    });

    await subscriptionBillingService.collectPlatformInvoice(superActor(), created.id, {
      amount: 999,
    });

    const updated = await LibraryModel.findById(lib._id).lean();
    expect(updated?.status).toBe(LIBRARY_STATUS.ACTIVE);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(updated?.suspendedAt).toBeFalsy();
    expect(updated?.suspensionReason).toBeFalsy();
  });

  it('marks open invoices overdue when due date passed', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Overdue Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'ov@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    const issue = new Date();
    issue.setDate(issue.getDate() - 20);
    const due = new Date();
    due.setDate(due.getDate() - 1);

    await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
    });

    await subscriptionBillingService.markOverdueInvoices();
    const doc = await PlatformSubscriptionInvoiceModel.findOne({ libraryId: lib._id }).lean();
    expect(doc?.status).toBe(PLATFORM_SUBSCRIPTION_INVOICE_STATUS.OVERDUE);
  });

  it('blocks owner from reading another tenants invoice', async () => {
    const plan = await seedPlan();
    const libA = await LibraryModel.create({
      name: 'A',
      slug: `a-${crypto.randomBytes(3).toString('hex')}`,
      email: 'a@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });
    const libB = await LibraryModel.create({
      name: 'B',
      slug: `b-${crypto.randomBytes(3).toString('hex')}`,
      email: 'b@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const created = await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(libA._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
    });

    const ownerBId = new mongoose.Types.ObjectId().toString();
    await expect(
      subscriptionBillingService.getOwnerInvoice(ownerActor(String(libB._id), ownerBId), created.id),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('create with partial payment at issue stays PARTIAL and does not activate library', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Partial Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'partial@test.com',
      status: LIBRARY_STATUS.SUSPENDED,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
      suspendedAt: new Date(),
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const inv = await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
      paidAmount: 400,
    });

    expect(inv.status).toBe(PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PARTIAL);
    expect(inv.dueAmount).toBe(599);
    const updated = await LibraryModel.findById(lib._id).lean();
    expect(updated?.status).toBe(LIBRARY_STATUS.SUSPENDED);
  });

  it('create with full payment activates library immediately', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Paid Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'paid@test.com',
      status: LIBRARY_STATUS.SUSPENDED,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
      suspendedAt: new Date(),
      suspensionReason: 'Due',
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const inv = await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
      paidAmount: 999,
    });

    expect(inv.status).toBe(PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID);
    const updated = await LibraryModel.findById(lib._id).lean();
    expect(updated?.status).toBe(LIBRARY_STATUS.ACTIVE);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(updated?.suspendedAt).toBeFalsy();
  });

  it('unpaid invoice does not activate subscription', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Unpaid Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'unpaid@test.com',
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
      paidAmount: 0,
    });

    const updated = await LibraryModel.findById(lib._id).lean();
    expect(updated?.status).toBe(LIBRARY_STATUS.ACTIVE);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });

  it('collecting remaining payment activates subscription', async () => {
    const plan = await seedPlan();
    const lib = await LibraryModel.create({
      name: 'Collect Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'collect@test.com',
      status: LIBRARY_STATUS.SUSPENDED,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.PAST_DUE,
      suspendedAt: new Date(),
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const created = await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
      paidAmount: 200,
    });

    await subscriptionBillingService.collectPlatformInvoice(superActor(), created.id, {
      amount: 799,
    });

    const updated = await LibraryModel.findById(lib._id).lean();
    expect(updated?.status).toBe(LIBRARY_STATUS.ACTIVE);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });

  it('trial library can convert to paid plan via invoice', async () => {
    const plan = await seedPlan();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 5);
    const lib = await LibraryModel.create({
      name: 'Trial Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'trial@test.com',
      status: LIBRARY_STATUS.TRIAL,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.TRIAL,
      trialEndsAt: trialEnd,
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    const inv = await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(lib._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
      paidAmount: 999,
      startPaidAfterTrial: true,
    });

    expect(inv.status).toBe(PLATFORM_SUBSCRIPTION_INVOICE_STATUS.PAID);
    const sub = await LibrarySubscriptionModel.findOne({ libraryId: lib._id }).lean();
    expect(sub?.upcomingPlanCode).toBeTruthy();

    const updated = await LibraryModel.findById(lib._id).lean();
    expect(updated?.status).toBe(LIBRARY_STATUS.TRIAL);
  });

  it('rejects invalid invoice dates via validation schema', () => {
    const libId = new mongoose.Types.ObjectId().toString();
    const planId = new mongoose.Types.ObjectId().toString();
    const issue = new Date('2026-05-01');
    const due = new Date('2026-04-01');

    const parsed = createPlatformSubscriptionInvoiceBodySchema.safeParse({
      libraryId: libId,
      planId,
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path.includes('dueDate'))).toBe(true);
    }
  });

  it('owner billing snapshot reflects paid invoice', async () => {
    const plan = await seedPlan();
    const ownerId = new mongoose.Types.ObjectId();
    const lib = await LibraryModel.create({
      name: 'Owner Bill Lib',
      slug: `lib-${crypto.randomBytes(3).toString('hex')}`,
      email: 'ownerbill@test.com',
      status: LIBRARY_STATUS.TRIAL,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.TRIAL,
      ownerId,
      trialEndsAt: new Date(Date.now() + 86400000 * 3),
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

    const snap = await subscriptionBillingService.buildTenantBillingSnapshot(String(lib._id));
    const sub = snap.subscription as { status?: string; expiryState?: string };
    expect(sub.status).toBe(SUBSCRIPTION_STATUS.ACTIVE);
    expect(snap.uiStatus).toBeTruthy();
  });

  it('owner listing only returns invoices for own library', async () => {
    const plan = await seedPlan();
    const libA = await LibraryModel.create({
      name: 'A',
      slug: `a-${crypto.randomBytes(3).toString('hex')}`,
      email: 'a2@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });
    const libB = await LibraryModel.create({
      name: 'B',
      slug: `b-${crypto.randomBytes(3).toString('hex')}`,
      email: 'b2@test.com',
      status: LIBRARY_STATUS.ACTIVE,
      subscriptionPlan: SUBSCRIPTION_PLAN.BASIC,
      subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
    });

    const issue = new Date();
    const due = new Date();
    due.setDate(due.getDate() + 7);

    await subscriptionBillingService.createPlatformInvoice(superActor(), {
      libraryId: String(libA._id),
      planId: String(plan._id),
      billingCycle: 'MONTHLY',
      issueDate: issue,
      dueDate: due,
    });

    const ownerAId = new mongoose.Types.ObjectId().toString();
    const listed = await subscriptionBillingService.listOwnerInvoices(ownerActor(String(libA._id), ownerAId), {});
    expect(listed.items.length).toBe(1);

    const ownerBId = new mongoose.Types.ObjectId().toString();
    const empty = await subscriptionBillingService.listOwnerInvoices(ownerActor(String(libB._id), ownerBId), {});
    expect(empty.items.length).toBe(0);
  });
});
