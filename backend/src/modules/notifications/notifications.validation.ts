import { z } from 'zod';
import { Types } from 'mongoose';

import { NOTIFICATION_CHANNELS, NOTIFICATION_TYPES, NOTIFICATION_STATUS, SEND_TARGET_ROLE_NAMES } from './notifications.constants';
import { paginationQuerySchema } from '@modules/payments/payment.validation';

const objectIdString = z
  .string()
  .trim()
  .refine((id) => Types.ObjectId.isValid(id), { message: 'Invalid ObjectId' });

const sendTargetSchema = z
  .object({
    mode: z.enum(['USER', 'ROLE', 'BRANCH', 'LIBRARY', 'STUDENTS_WITH_DUES', 'PLATFORM']),
    userId: objectIdString.optional(),
    role: z.enum(SEND_TARGET_ROLE_NAMES).optional(),
    branchId: objectIdString.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'USER' && !v.userId) {
      ctx.addIssue({ code: 'custom', message: 'userId is required for USER mode', path: ['userId'] });
    }
    if (v.mode === 'ROLE' && !v.role) {
      ctx.addIssue({ code: 'custom', message: 'role is required for ROLE mode', path: ['role'] });
    }
    if (v.mode === 'BRANCH' && !v.branchId) {
      ctx.addIssue({ code: 'custom', message: 'branchId is required for BRANCH mode', path: ['branchId'] });
    }
  });

export const notificationListQuerySchema = paginationQuerySchema.extend({
  libraryId: objectIdString.optional(),
  recipientUserId: objectIdString.optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  status: z.enum(NOTIFICATION_STATUS).optional(),
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export const notificationIdParamsSchema = z.object({
  notificationId: objectIdString,
});

export const sendNotificationBodySchema = z.object({
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(8000),
  type: z.enum(NOTIFICATION_TYPES),
  channel: z.enum(NOTIFICATION_CHANNELS).optional().default('IN_APP'),
  templateId: objectIdString.optional(),
  templateVariables: z.record(z.string(), z.string()).optional(),
  target: sendTargetSchema,
  /** When true, sender receives broadcast notifications (LIBRARY, ROLE, BRANCH, STUDENTS_WITH_DUES, PLATFORM). Default false. */
  includeSelf: z.coerce.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const bulkSendBodySchema = z.object({
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  items: z
    .array(sendNotificationBodySchema.omit({ libraryId: true, branchId: true }))
    .min(1)
    .max(25),
});

export const templateListQuerySchema = paginationQuerySchema.extend({
  libraryId: objectIdString.optional(),
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export const createTemplateBodySchema = z.object({
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  name: z.string().trim().min(1).max(120),
  type: z.enum(NOTIFICATION_TYPES),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
  variables: z.array(z.string().trim().max(64)).optional().default([]),
  active: z.coerce.boolean().optional().default(true),
});

export const updateTemplateBodySchema = createTemplateBodySchema.partial();

export const templateIdParamsSchema = z.object({
  templateId: objectIdString,
});

export const logsListQuerySchema = paginationQuerySchema.extend({
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
});

export const logIdParamsSchema = z.object({
  logId: objectIdString,
});

export const recipientsListQuerySchema = paginationQuerySchema.extend({
  /** SUPER_ADMIN must scope by library. */
  libraryId: objectIdString.optional(),
  branchId: objectIdString.optional(),
  role: z.enum(SEND_TARGET_ROLE_NAMES).optional(),
  q: z.string().trim().max(120).optional(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type SendNotificationBody = z.infer<typeof sendNotificationBodySchema>;
export type BulkSendBody = z.infer<typeof bulkSendBodySchema>;
export type TemplateListQuery = z.infer<typeof templateListQuerySchema>;
export type LogsListQuery = z.infer<typeof logsListQuerySchema>;
export type RecipientsListQuery = z.infer<typeof recipientsListQuerySchema>;
export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;
export type UpdateTemplateBody = z.infer<typeof updateTemplateBodySchema>;
