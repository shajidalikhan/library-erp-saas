import { describe, expect, it, vi, beforeEach } from 'vitest';

import { PlatformSettingModel } from './platform-setting.model';
import { loadPlatformSupportConfig } from './platform-settings.support';

describe('loadPlatformSupportConfig', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns contacts and visibility flags from platform settings', async () => {
    vi.spyOn(PlatformSettingModel, 'findOne').mockReturnValue({
      lean: () =>
        Promise.resolve({
          supportEmail: 'help@libraryerp.com',
          salesEmail: 'sales@libraryerp.com',
          supportPhone: '+911111111111',
          billingPhone: '+912222222222',
          whatsappSupport: '+913333333333',
          showSupportEmail: true,
          showSupportPhone: false,
          showWhatsappSupport: true,
          showSalesEmail: true,
        }),
    } as never);

    const cfg = await loadPlatformSupportConfig();
    expect(cfg.supportEmail).toBe('help@libraryerp.com');
    expect(cfg.showSupportPhone).toBe(false);
    expect(cfg.showWhatsappSupport).toBe(true);
    expect(cfg.whatsappSupport).toBe('+913333333333');
  });
});
