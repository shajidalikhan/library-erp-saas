export const EMAIL_TEMPLATE_KEYS = [
  'forgot_password',
  'demo_request_received',
  'payment_reminder',
  'invoice_due',
  'tenant_suspended',
  'welcome_user',
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export const isEmailTemplateKey = (key: string): key is EmailTemplateKey =>
  (EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key);
