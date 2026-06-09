import { Types } from 'mongoose';

import { ENV } from '@config/env.config';
import { ROLES } from '@constants/roles.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { UserModel } from '@modules/auth/auth.models';
import { PlatformSettingModel } from '@modules/platform/platform-setting.model';
import { sendEmail } from '@/services/email.service';
import { authService, type SafeUser } from '@modules/auth/auth.service';

import { emailTemplateService } from './email-template.service';
import type {
  PatchNotificationPreferencesBody,
  PatchProfileBody,
  TestEmailBody,
} from './settings.validation';

function requireSuperAdmin(user: AuthenticatedUser): void {
  if (user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Super admin access required');
  }
}

async function getPlatformSettingsDoc() {
  let doc = await PlatformSettingModel.findOne({ singletonKey: 'default' }).lean();
  if (!doc) {
    await PlatformSettingModel.create({ singletonKey: 'default' });
    doc = await PlatformSettingModel.findOne({ singletonKey: 'default' }).lean();
  }
  return doc;
}

class SettingsService {
  async getProfile(userId: string): Promise<SafeUser> {
    return authService.getCurrentUser(userId);
  }

  async patchProfile(userId: string, body: PatchProfileBody): Promise<SafeUser> {
    const update: Record<string, unknown> = {};
    if (body.fullName !== undefined) update.fullName = body.fullName;
    if (body.phone !== undefined) update.phone = body.phone || undefined;

    if (Object.keys(update).length === 0) {
      return authService.getCurrentUser(userId);
    }

    const user = await UserModel.findByIdAndUpdate(userId, { $set: update }, { new: true });
    if (!user) throw ApiError.notFound('User not found');
    return authService.getCurrentUser(userId);
  }

  async getNotificationPreferences(userId: string) {
    const user = await UserModel.findById(userId).select('notificationPreferences').lean();
    if (!user) throw ApiError.notFound('User not found');
    const prefs = user.notificationPreferences ?? { emailEnabled: true, inAppEnabled: true };
    return prefs;
  }

  async patchNotificationPreferences(userId: string, body: PatchNotificationPreferencesBody) {
    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const current = user.notificationPreferences ?? { emailEnabled: true, inAppEnabled: true };
    user.notificationPreferences = {
      emailEnabled: body.emailEnabled ?? current.emailEnabled,
      inAppEnabled: body.inAppEnabled ?? current.inAppEnabled,
    };
    await user.save();
    return user.notificationPreferences;
  }

  async getEmailSettings(user: AuthenticatedUser) {
    requireSuperAdmin(user);
    const platform = await getPlatformSettingsDoc();
    return {
      smtpConfigured: ENV.SMTP_CONFIGURED,
      smtpHost: ENV.SMTP_HOST || null,
      smtpPort: ENV.SMTP_PORT,
      smtpSecure: ENV.SMTP_SECURE_EFFECTIVE,
      smtpFrom: ENV.SMTP_FROM || ENV.SMTP_USER || null,
      smtpUser: ENV.SMTP_USER || null,
      supportEmail: platform?.supportEmail ?? '',
      salesEmail: platform?.salesEmail ?? '',
      demoRequestNotifyEmail: platform?.demoRequestNotifyEmail ?? '',
    };
  }

  async sendTestEmail(user: AuthenticatedUser, body: TestEmailBody): Promise<void> {
    requireSuperAdmin(user);
    const subject = body.subject?.trim() || 'Library ERP test email';
    const message =
      body.message?.trim() ||
      'This is a test email from Library ERP. SMTP is configured correctly.';
    const html = `<div style="font-family:Arial,sans-serif;padding:24px;"><h1>${subject}</h1><p>${message}</p></div>`;

    if (!ENV.SMTP_CONFIGURED && !ENV.IS_PROD) {
      // eslint-disable-next-line no-console
      console.info(`[email:test] To: ${body.to} | Subject: ${subject}\n${message}`);
    }

    await sendEmail({ to: body.to, subject, html, text: message });
  }
}

export const settingsService = new SettingsService();
export { emailTemplateService };
