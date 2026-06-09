import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { requireAuthUser } from '@middlewares/auth.middleware';

import { notificationsService } from './notifications.service';
import type {
  BulkSendBody,
  CreateTemplateBody,
  LogsListQuery,
  NotificationListQuery,
  RecipientsListQuery,
  SendNotificationBody,
  TemplateListQuery,
  UpdateTemplateBody,
} from './notifications.validation';

class NotificationsController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as NotificationListQuery;
    const data = await notificationsService.list(user, query);
    return ApiResponse.ok(res, data, 'Notifications');
  });

  unreadCount = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await notificationsService.unreadCount(user);
    return ApiResponse.ok(res, data, 'Unread count');
  });

  markRead = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { notificationId } = (req.validatedParams ?? req.params) as { notificationId: string };
    const data = await notificationsService.markRead(user, notificationId);
    return ApiResponse.ok(res, data, 'Marked read');
  });

  markAllRead = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const data = await notificationsService.markAllRead(user);
    return ApiResponse.ok(res, data, 'Marked all read');
  });

  send = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = req.validatedBody as SendNotificationBody;
    const data = await notificationsService.send(user, body);
    return ApiResponse.created(res, data, 'Notification sent');
  });

  bulkSend = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = req.validatedBody as BulkSendBody;
    const data = await notificationsService.bulkSend(user, body);
    return ApiResponse.created(res, data, 'Bulk notifications sent');
  });

  listTemplates = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as TemplateListQuery;
    const data = await notificationsService.listTemplates(user, query);
    return ApiResponse.ok(res, data, 'Templates');
  });

  createTemplate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const body = req.validatedBody as CreateTemplateBody;
    const data = await notificationsService.createTemplate(user, body);
    return ApiResponse.created(res, data, 'Template created');
  });

  updateTemplate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { templateId } = (req.validatedParams ?? req.params) as { templateId: string };
    const body = req.validatedBody as UpdateTemplateBody;
    const data = await notificationsService.updateTemplate(user, templateId, body);
    return ApiResponse.ok(res, data, 'Template updated');
  });

  deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { templateId } = (req.validatedParams ?? req.params) as { templateId: string };
    const data = await notificationsService.deleteTemplate(user, templateId);
    return ApiResponse.ok(res, data, 'Template deleted');
  });

  listLogs = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as LogsListQuery;
    const data = await notificationsService.listLogs(user, query);
    return ApiResponse.ok(res, data, 'Notification logs');
  });

  listRecipients = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const query = (req.validatedQuery ?? req.query) as RecipientsListQuery;
    const data = await notificationsService.listRecipients(user, query);
    return ApiResponse.ok(res, data, 'Recipients');
  });

  getLogById = asyncHandler(async (req: Request, res: Response) => {
    const user = requireAuthUser(req.user);
    const { logId } = (req.validatedParams ?? req.params) as { logId: string };
    const data = await notificationsService.getLogById(user, logId);
    return ApiResponse.ok(res, data, 'Notification log detail');
  });
}

export const notificationsController = new NotificationsController();
