import { describe, expect, it } from 'vitest';

import { resolveEmergencyContactPhone } from './student-contact';

describe('resolveEmergencyContactPhone', () => {
  it('prefers emergency contact phone', () => {
    expect(
      resolveEmergencyContactPhone({
        emergencyContactPhone: '9999999999',
        guardianPhone: '8888888888',
      }),
    ).toBe('9999999999');
  });

  it('falls back to guardian phone for legacy records', () => {
    expect(resolveEmergencyContactPhone({ guardianPhone: '8888888888' })).toBe('8888888888');
  });
});
