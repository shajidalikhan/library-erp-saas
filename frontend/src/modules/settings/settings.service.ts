import { request } from '@/lib/axios';
import type { AuthUser } from '@/types/auth';

export type EmailTemplate = {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  active: boolean;
  updatedBy: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type EmailSettings = {
  smtpConfigured: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpFrom: string | null;
  smtpUser: string | null;
  supportEmail: string;
  salesEmail: string;
  demoRequestNotifyEmail: string;
};

export type NotificationPreferences = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
};

export const settingsApi = {
  getProfile: async () => {
    const res = await request<{ user: AuthUser }>({ url: '/settings/profile', method: 'GET' });
    return res.user;
  },

  patchProfile: async (body: { fullName?: string; phone?: string | null }) => {
    const res = await request<{ user: AuthUser }>({
      url: '/settings/profile',
      method: 'PATCH',
      data: body,
    });
    return res.user;
  },

  getNotificationPreferences: () =>
    request<{ preferences: NotificationPreferences }>({
      url: '/settings/notifications',
      method: 'GET',
    }).then((r) => r.preferences),

  patchNotificationPreferences: (body: Partial<NotificationPreferences>) =>
    request<{ preferences: NotificationPreferences }>({
      url: '/settings/notifications',
      method: 'PATCH',
      data: body,
    }).then((r) => r.preferences),

  getEmailSettings: () =>
    request<EmailSettings>({ url: '/settings/email', method: 'GET' }),

  sendTestEmail: (body: { to: string; subject?: string; message?: string }) =>
    request<null>({ url: '/settings/email/test', method: 'POST', data: body }),

  listEmailTemplates: () =>
    request<{ templates: EmailTemplate[] }>({
      url: '/settings/email-templates',
      method: 'GET',
    }).then((r) => r.templates),

  getEmailTemplate: (key: string) =>
    request<{ template: EmailTemplate }>({
      url: `/settings/email-templates/${key}`,
      method: 'GET',
    }).then((r) => r.template),

  patchEmailTemplate: (key: string, body: Partial<EmailTemplate>) =>
    request<{ template: EmailTemplate }>({
      url: `/settings/email-templates/${key}`,
      method: 'PATCH',
      data: body,
    }).then((r) => r.template),

  resetEmailTemplate: (key: string) =>
    request<{ template: EmailTemplate }>({
      url: `/settings/email-templates/${key}/reset`,
      method: 'POST',
    }).then((r) => r.template),

  previewEmailTemplate: (
    key: string,
    body: { subject: string; htmlBody: string; textBody: string; variables?: Record<string, string> },
  ) =>
    request<{ preview: { subject: string; html: string; text: string } }>({
      url: `/settings/email-templates/${key}/preview`,
      method: 'POST',
      data: body,
    }).then((r) => r.preview),
};
