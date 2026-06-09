import { describe, expect, it } from 'vitest';

import {
  collectPaymentBodySchema,
  createFeePlanBodySchema,
  createInvoiceBodySchema,
  updateInvoiceBodySchema,
} from './payment.validation';

describe('payment.validation', () => {
  it('validates fee plan body', () => {
    const r = createFeePlanBodySchema.safeParse({
      branchId: '507f1f77bcf86cd799439011',
      name: 'Monthly',
      amount: 1200,
      durationDays: 30,
    });
    expect(r.success).toBe(true);
  });

  it('rejects fee plan with invalid branch ObjectId', () => {
    const r = createFeePlanBodySchema.safeParse({
      branchId: 'not-an-id',
      name: 'X',
      amount: 1,
      durationDays: 1,
    });
    expect(r.success).toBe(false);
  });

  it('rejects fee plan with empty name', () => {
    const r = createFeePlanBodySchema.safeParse({
      branchId: '507f1f77bcf86cd799439011',
      name: '   ',
      amount: 1,
      durationDays: 1,
    });
    expect(r.success).toBe(false);
  });

  it('rejects fee plan with non-positive durationDays', () => {
    const r = createFeePlanBodySchema.safeParse({
      branchId: '507f1f77bcf86cd799439011',
      name: 'Plan',
      amount: 100,
      durationDays: 0,
    });
    expect(r.success).toBe(false);
  });

  it('allows create invoice with feePlanId and no amount', () => {
    const ok = createInvoiceBodySchema.safeParse({
      branchId: '507f1f77bcf86cd799439011',
      studentId: '507f1f77bcf86cd799439012',
      feePlanId: '507f1f77bcf86cd799439013',
      dueDate: new Date(),
    });
    expect(ok.success).toBe(true);
  });

  it('collect payment validates method enum', () => {
    const ok = collectPaymentBodySchema.safeParse({
      invoiceId: '507f1f77bcf86cd799439011',
      amount: 100,
      method: 'CASH',
    });
    expect(ok.success).toBe(true);
    const bad = collectPaymentBodySchema.safeParse({
      invoiceId: '507f1f77bcf86cd799439011',
      amount: 100,
      method: 'GOLD',
    });
    expect(bad.success).toBe(false);
  });

  it('create invoice requires amount when no fee plan', () => {
    const bad = createInvoiceBodySchema.safeParse({
      branchId: '507f1f77bcf86cd799439011',
      studentId: '507f1f77bcf86cd799439012',
      dueDate: new Date(),
    });
    expect(bad.success).toBe(false);
  });

  it('accepts optional libraryId on fee plan create body', () => {
    const r = createFeePlanBodySchema.safeParse({
      libraryId: '507f1f77bcf86cd799439011',
      branchId: '507f1f77bcf86cd799439012',
      name: 'Plan',
      amount: 1,
      durationDays: 1,
    });
    expect(r.success).toBe(true);
  });

  it('accepts optional libraryId on invoice create body', () => {
    const r = createInvoiceBodySchema.safeParse({
      libraryId: '507f1f77bcf86cd799439011',
      branchId: '507f1f77bcf86cd799439012',
      studentId: '507f1f77bcf86cd799439013',
      amount: 10,
      dueDate: new Date(),
    });
    expect(r.success).toBe(true);
  });
});
