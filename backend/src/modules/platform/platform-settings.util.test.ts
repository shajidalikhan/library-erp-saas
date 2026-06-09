import { describe, expect, it } from 'vitest';

import { resolveDemoRequestNotifyEmail } from './platform-settings.util';

describe('resolveDemoRequestNotifyEmail', () => {
  it('prefers demoRequestNotifyEmail, then salesEmail, then SMTP fallbacks', () => {
    expect(
      resolveDemoRequestNotifyEmail({
        demoRequestNotifyEmail: 'leads@example.com',
        salesEmail: 'sales@example.com',
      }),
    ).toBe('leads@example.com');

    expect(
      resolveDemoRequestNotifyEmail({
        demoRequestNotifyEmail: '',
        salesEmail: 'sales@example.com',
      }),
    ).toBe('sales@example.com');
  });
});
