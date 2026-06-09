import { z } from 'zod';

export const patchProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
});

export const patchNotificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
});

export const patchEmailTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  subject: z.string().trim().min(1).max(300).optional(),
  htmlBody: z.string().min(1).max(50_000).optional(),
  textBody: z.string().min(1).max(20_000).optional(),
  active: z.boolean().optional(),
});

export const previewEmailTemplateSchema = z.object({
  subject: z.string().min(1).max(300),
  htmlBody: z.string().min(1).max(50_000),
  textBody: z.string().min(1).max(20_000),
  variables: z.record(z.string(), z.string()).optional().default({}),
});

export const testEmailSchema = z.object({
  to: z.string().trim().email('Invalid email address'),
  subject: z.string().trim().min(1).max(300).optional(),
  message: z.string().trim().min(1).max(2000).optional(),
});

export type PatchProfileBody = z.infer<typeof patchProfileSchema>;
export type PatchNotificationPreferencesBody = z.infer<typeof patchNotificationPreferencesSchema>;
export type PatchEmailTemplateBody = z.infer<typeof patchEmailTemplateSchema>;
export type PreviewEmailTemplateBody = z.infer<typeof previewEmailTemplateSchema>;
export type TestEmailBody = z.infer<typeof testEmailSchema>;
