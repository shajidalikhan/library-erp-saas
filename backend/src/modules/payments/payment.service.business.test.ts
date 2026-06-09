import { describe, expect, it } from 'vitest';

import {
  roundMoney,
  computeTotalAmount,
  deriveInvoiceStatus,
  __paymentTestables,
} from './payment.service';

const { tenantFilterForUser } = __paymentTestables;

import type { AuthenticatedUser } from '@/types/express';
import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';

describe('payment.service finance helpers', () => {
  it('rounds to 2dp', () => {
    expect(roundMoney(1.005)).toBe(1.01);
  });

  it('computes total with discount and tax', () => {
    expect(computeTotalAmount(1000, 100, 18)).toBe(918);
  });

  it('marks PAID when settled', () => {
    const s = deriveInvoiceStatus({
      status: 'UNPAID',
      totalAmount: 100,
      paidAmount: 100,
      dueAmount: 0,
      dueDate: new Date('2026-02-01'),
      refundTotal: 0,
      now: new Date('2026-01-01'),
    });
    expect(s).toBe('PAID');
  });

  it('marks OVERDUE when unpaid past due', () => {
    const s = deriveInvoiceStatus({
      status: 'UNPAID',
      totalAmount: 100,
      paidAmount: 0,
      dueAmount: 100,
      dueDate: new Date('2026-01-01'),
      refundTotal: 0,
      now: new Date('2026-02-01'),
    });
    expect(s).toBe('OVERDUE');
  });

  it('marks PARTIAL when some amount paid and balance remains', () => {
    const s = deriveInvoiceStatus({
      status: 'UNPAID',
      totalAmount: 100,
      paidAmount: 25,
      dueAmount: 75,
      dueDate: new Date('2026-12-31'),
      refundTotal: 0,
      now: new Date('2026-01-01'),
    });
    expect(s).toBe('PARTIAL');
  });

  it('keeps UNPAID when due in future and nothing paid', () => {
    const s = deriveInvoiceStatus({
      status: 'UNPAID',
      totalAmount: 40,
      paidAmount: 0,
      dueAmount: 40,
      dueDate: new Date('2026-12-31'),
      refundTotal: 0,
      now: new Date('2026-01-01'),
    });
    expect(s).toBe('UNPAID');
  });

  it('tenantFilter pins branch for manager', () => {
    const u: AuthenticatedUser = {
      id: 'x',
      role: ROLES.MANAGER,
      permissions: [PERMISSIONS.PAYMENT_READ],
      libraryId: '507f1f77bcf86cd799439011',
      branchId: '507f1f77bcf86cd799439012',
    };
    const f = tenantFilterForUser(u, {});
    expect(String(f.branchId)).toContain('507f1f77bcf86cd799439012');
  });
});
