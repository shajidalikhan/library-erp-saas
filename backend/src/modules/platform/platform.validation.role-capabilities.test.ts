import { describe, expect, it } from 'vitest';

import { patchRoleCapabilitiesSchema } from './platform.validation';

describe('patchRoleCapabilitiesSchema', () => {
  it('accepts partial action updates', () => {
    const parsed = patchRoleCapabilitiesSchema.parse({
      role: 'MANAGER',
      actions: { students: { create: false } },
    });
    expect(parsed.actions?.students?.create).toBe(false);
  });

  it('accepts module boolean patch', () => {
    const parsed = patchRoleCapabilitiesSchema.parse({
      role: 'MANAGER',
      modules: { seats: false },
    });
    expect(parsed.modules?.seats).toBe(false);
  });
});
