import { describe, expect, it } from 'vitest';

import { mergeRoleModulePatch } from './role-capabilities';
import type { RoleCapabilityModule } from '@/types/auth';

const base = {
  students: true,
  attendance: true,
  seats: true,
  shifts: false,
  payments: false,
  invoices: false,
  dues: false,
  reports: false,
  analytics: false,
  notifications: false,
  settings: true,
  public_booking: false,
} satisfies Record<RoleCapabilityModule, boolean>;

describe('mergeRoleModulePatch', () => {
  it('returns full boolean map without undefined keys', () => {
    const merged = mergeRoleModulePatch(base, { seats: false });
    expect(merged.seats).toBe(false);
    expect(merged.students).toBe(true);
    expect(Object.values(merged).every((v) => typeof v === 'boolean')).toBe(true);
  });
});
