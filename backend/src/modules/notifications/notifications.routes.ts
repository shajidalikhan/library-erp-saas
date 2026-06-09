import { Router } from 'express';

import { PERMISSIONS } from '@constants/permissions.constants';
import { authenticate } from '@middlewares/auth.middleware';
import { requireRoleCapability } from '@middlewares/role-capability.middleware';
import { authorize, authorizeAny } from '@middlewares/rbac.middleware';
import { validate } from '@middlewares/validate.middleware';
import { requireSubscriptionFeature } from '@middlewares/require-subscription-feature.middleware';

import { notificationsController } from './notifications.controller';
import {
  bulkSendBodySchema,
  createTemplateBodySchema,
  logIdParamsSchema,
  logsListQuerySchema,
  notificationIdParamsSchema,
  notificationListQuerySchema,
  recipientsListQuerySchema,
  sendNotificationBodySchema,
  templateIdParamsSchema,
  templateListQuerySchema,
  updateTemplateBodySchema,
} from './notifications.validation';

const router = Router();

router.use(authenticate);

router.get(
  '/notifications',
  authorize(PERMISSIONS.NOTIFICATION_READ),
  validate({ query: notificationListQuerySchema }),
  notificationsController.list,
);

router.get(
  '/notifications/unread-count',
  authorize(PERMISSIONS.NOTIFICATION_READ),
  notificationsController.unreadCount,
);

router.patch(
  '/notifications/:notificationId/read',
  authorize(PERMISSIONS.NOTIFICATION_READ),
  validate({ params: notificationIdParamsSchema }),
  notificationsController.markRead,
);

router.patch(
  '/notifications/read-all',
  authorize(PERMISSIONS.NOTIFICATION_READ),
  notificationsController.markAllRead,
);

router.post(
  '/notifications/send',
  requireSubscriptionFeature('notifications'),
  authorize(PERMISSIONS.NOTIFICATION_SEND),
  requireRoleCapability('notifications', 'send', PERMISSIONS.NOTIFICATION_SEND),
  validate({ body: sendNotificationBodySchema }),
  notificationsController.send,
);

router.post(
  '/notifications/bulk-send',
  requireSubscriptionFeature('notifications'),
  authorize(PERMISSIONS.NOTIFICATION_SEND),
  validate({ body: bulkSendBodySchema }),
  notificationsController.bulkSend,
);

router.get(
  '/notifications/recipients',
  authorize(PERMISSIONS.NOTIFICATION_SEND),
  validate({ query: recipientsListQuerySchema }),
  notificationsController.listRecipients,
);

router.get(
  '/notifications/templates',
  authorizeAny(
    PERMISSIONS.NOTIFICATION_READ,
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE,
  ),
  validate({ query: templateListQuerySchema }),
  notificationsController.listTemplates,
);

router.post(
  '/notifications/templates',
  authorize(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate({ body: createTemplateBodySchema }),
  notificationsController.createTemplate,
);

router.patch(
  '/notifications/templates/:templateId',
  authorize(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate({ params: templateIdParamsSchema, body: updateTemplateBodySchema }),
  notificationsController.updateTemplate,
);

router.delete(
  '/notifications/templates/:templateId',
  authorize(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  validate({ params: templateIdParamsSchema }),
  notificationsController.deleteTemplate,
);

router.get(
  '/notifications/logs/:logId',
  authorize(PERMISSIONS.NOTIFICATION_MANAGE),
  validate({ params: logIdParamsSchema }),
  notificationsController.getLogById,
);

router.get(
  '/notifications/logs',
  authorize(PERMISSIONS.NOTIFICATION_MANAGE),
  validate({ query: logsListQuerySchema }),
  notificationsController.listLogs,
);

export { router as notificationsRoutes };
