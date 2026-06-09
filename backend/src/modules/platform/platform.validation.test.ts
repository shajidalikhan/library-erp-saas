import { describe, expect, it } from 'vitest';

import {
  createSubscriptionPlanSchema,
  patchPlatformSettingsSchema,
  patchSubscriptionPlanSchema,
  suspendTenantBodySchema,
  tenantsListQuerySchema,
} from './platform.validation';

describe('platform.validation', () => {
  it('parses tenants list query defaults', () => {
    const q = tenantsListQuerySchema.parse({ page: '2', limit: '10' });
    expect(q.page).toBe(2);
    expect(q.sortBy).toBe('createdAt');
  });

  it('requires suspend reason length', () => {
    expect(() => suspendTenantBodySchema.parse({ reason: 'no' })).toThrow();
    expect(suspendTenantBodySchema.parse({ reason: 'Valid reason text' }).reason).toContain('Valid');
  });

  it('createSubscriptionPlanSchema allows zero limits and rejects short plan keys', () => {
    expect(() =>
      createSubscriptionPlanSchema.parse({
        planKey: 'x',
        displayName: 'Pro',
        monthlyPrice: 0,
        yearlyPrice: 0,
        maxStudents: 0,
        maxBranches: 1,
        maxSeats: 1,
        maxStaff: 1,
        storageLimitMb: 0,
      }),
    ).toThrow();

    const ok = createSubscriptionPlanSchema.parse({
      planKey: 'pro_team',
      displayName: 'Pro Team',
      monthlyPrice: 10,
      yearlyPrice: 100,
      maxStudents: 100,
      maxBranches: 2,
      maxSeats: 80,
      maxStaff: 10,
      storageLimitMb: 2048,
      featureFlags: { multi_branch: true, exports: false },
      active: true,
      sortOrder: 2,
    });
    expect(ok.planKey).toBe('PRO_TEAM');
  });

  it('createSubscriptionPlanSchema normalizes spaced plan keys', () => {
    const ok = createSubscriptionPlanSchema.parse({
      planKey: 'starter plan',
      displayName: 'Starter',
      monthlyPrice: 10,
      yearlyPrice: 100,
      maxStudents: 10,
      maxBranches: 1,
      maxSeats: 10,
      maxStaff: 2,
      storageLimitMb: 512,
    });
    expect(ok.planKey).toBe('STARTER_PLAN');
  });

  it('patchSubscriptionPlanSchema normalizes and rejects invalid plan keys', () => {
    expect(() => patchSubscriptionPlanSchema.parse({ planKey: '!' })).toThrow();
    expect(() => patchSubscriptionPlanSchema.parse({ planKey: 'x' })).toThrow();
    expect(patchSubscriptionPlanSchema.parse({ planKey: 'starter' }).planKey).toBe('STARTER');
    expect(patchSubscriptionPlanSchema.parse({ planKey: 'bad-key!' }).planKey).toBe('BADKEY');
  });

  it('rejects unknown subscription plan feature flag keys', () => {
    const base = {
      planKey: 'PRO',
      displayName: 'X',
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxStudents: 1,
      maxBranches: 1,
      maxSeats: 1,
      maxStaff: 1,
      storageLimitMb: 1,
    };
    expect(() =>
      createSubscriptionPlanSchema.parse({
        ...base,
        featureFlags: { multi_branch: true, unknown_flag: true },
      }),
    ).toThrow();
    expect(() =>
      patchSubscriptionPlanSchema.parse({
        featureFlags: { not_in_catalog: false },
      }),
    ).toThrow();
  });

  it('patchSubscriptionPlanSchema allows partial updates with validated numbers', () => {
    expect(patchSubscriptionPlanSchema.parse({ monthlyPrice: 0 })).toEqual({ monthlyPrice: 0 });
    expect(patchSubscriptionPlanSchema.parse({ storageLimitMb: 0 })).toEqual({ storageLimitMb: 0 });
    expect(() => patchSubscriptionPlanSchema.parse({ maxSeats: -1 })).toThrow();
  });

  it('patchPlatformSettingsSchema accepts demo request notification emails', () => {
    const body = patchPlatformSettingsSchema.parse({
      supportEmail: 'support@example.com',
      salesEmail: 'sales@example.com',
      demoRequestNotifyEmail: 'leads@example.com',
    });
    expect(body.demoRequestNotifyEmail).toBe('leads@example.com');
    expect(body.salesEmail).toBe('sales@example.com');
  });

  it('patchPlatformSettingsSchema accepts support and billing phone numbers', () => {
    const body = patchPlatformSettingsSchema.parse({
      supportPhone: '+91 98765 43210',
      billingPhone: '+91 80000 00000',
    });
    expect(body.supportPhone).toContain('98765');
    expect(body.billingPhone).toContain('80000');
  });
});
