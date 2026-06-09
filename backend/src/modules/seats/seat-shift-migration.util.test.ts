import { describe, expect, it } from 'vitest';

import { SHIFT_KINDS } from '@modules/shifts/shift.constants';
import { SHIFT_TYPES } from './seat.constants';

describe('legacy shift mapping', () => {
  it('maps all legacy seat shift types to shift kinds', () => {
    const map: Record<string, string> = {
      MORNING: 'MORNING',
      EVENING: 'EVENING',
      NIGHT: 'NIGHT',
      FULL_DAY: 'FULL_DAY',
    };
    for (const t of SHIFT_TYPES) {
      expect(map[t]).toBeDefined();
      expect(SHIFT_KINDS).toContain(map[t]);
    }
  });
});
