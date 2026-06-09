import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { ApiError } from '@utils/ApiError';

const paramKey = (req: Request): string => {
  const key = req.params.key;
  if (typeof key === 'string') return key;
  if (Array.isArray(key) && key[0]) return key[0];
  throw ApiError.badRequest('Template key is required');
};

import { settingsService, emailTemplateService } from './settings.service';
import type {
  PatchEmailTemplateBody,
  PatchNotificationPreferencesBody,
  PatchProfileBody,
  PreviewEmailTemplateBody,
  TestEmailBody,
} from './settings.validation';

class SettingsController {
  getProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const user = await settingsService.getProfile(req.user.id);
    return ApiResponse.ok(res, { user }, 'Profile loaded');
  });

  patchProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validatedBody as PatchProfileBody;
    const user = await settingsService.patchProfile(req.user.id, body);
    return ApiResponse.ok(res, { user }, 'Profile updated');
  });

  getNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const preferences = await settingsService.getNotificationPreferences(req.user.id);
    return ApiResponse.ok(res, { preferences }, 'Notification preferences');
  });

  patchNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validatedBody as PatchNotificationPreferencesBody;
    const preferences = await settingsService.patchNotificationPreferences(req.user.id, body);
    return ApiResponse.ok(res, { preferences }, 'Notification preferences updated');
  });

  getEmailSettings = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const data = await settingsService.getEmailSettings(req.user);
    return ApiResponse.ok(res, data, 'Email settings');
  });

  sendTestEmail = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validatedBody as TestEmailBody;
    await settingsService.sendTestEmail(req.user, body);
    return ApiResponse.ok(res, null, 'Test email sent');
  });

  listEmailTemplates = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const templates = await emailTemplateService.list(req.user);
    return ApiResponse.ok(res, { templates }, 'Email templates');
  });

  getEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const template = await emailTemplateService.getByKey(req.user, paramKey(req));
    return ApiResponse.ok(res, { template }, 'Email template');
  });

  patchEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validatedBody as PatchEmailTemplateBody;
    const template = await emailTemplateService.patch(req.user, paramKey(req), body);
    return ApiResponse.ok(res, { template }, 'Email template updated');
  });

  resetEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const template = await emailTemplateService.resetToDefault(req.user, paramKey(req));
    return ApiResponse.ok(res, { template }, 'Email template reset to default');
  });

  seedEmailTemplates = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const result = await emailTemplateService.seedDefaults(req.user);
    return ApiResponse.ok(res, result, 'Default email templates seeded');
  });

  previewEmailTemplate = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized();
    const body = req.validatedBody as PreviewEmailTemplateBody;
    const preview = emailTemplateService.preview(paramKey(req), body, body.variables);
    return ApiResponse.ok(res, { preview }, 'Template preview');
  });
}

export const settingsController = new SettingsController();
