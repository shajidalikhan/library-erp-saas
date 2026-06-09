import { PlatformSettingModel } from './platform-setting.model';

export type PlatformSupportConfig = {
  supportEmail: string;
  salesEmail: string;
  supportPhone: string;
  billingPhone: string;
  whatsappSupport: string;
  showSupportEmail: boolean;
  showSupportPhone: boolean;
  showWhatsappSupport: boolean;
  showSalesEmail: boolean;
};

/** Shared platform support contacts + visibility flags for billing UI and public hooks. */
export async function loadPlatformSupportConfig(): Promise<PlatformSupportConfig> {
  const s = await PlatformSettingModel.findOne({ singletonKey: 'default' }).lean();
  return {
    supportEmail: s?.supportEmail ?? '',
    salesEmail: s?.salesEmail ?? '',
    supportPhone: s?.supportPhone ?? '',
    billingPhone: s?.billingPhone ?? '',
    whatsappSupport: s?.whatsappSupport ?? '',
    showSupportEmail: s?.showSupportEmail !== false,
    showSupportPhone: s?.showSupportPhone !== false,
    showWhatsappSupport: Boolean(s?.showWhatsappSupport),
    showSalesEmail: s?.showSalesEmail !== false,
  };
}
