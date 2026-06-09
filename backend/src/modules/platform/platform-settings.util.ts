import { ENV } from '@config/env.config';

export type DemoRequestNotifySettings = {
  demoRequestNotifyEmail?: string | null;
  salesEmail?: string | null;
};

export function resolveDemoRequestNotifyEmail(settings: DemoRequestNotifySettings): string | null {
  for (const value of [
    settings.demoRequestNotifyEmail,
    settings.salesEmail,
    ENV.SMTP_FROM,
    ENV.SMTP_USER,
  ]) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}
