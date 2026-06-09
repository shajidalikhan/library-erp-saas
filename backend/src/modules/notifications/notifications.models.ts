import { NotificationModel } from './notification.model';
import { NotificationTemplateModel } from './notification-template.model';
import { NotificationLogModel } from './notification-log.model';

export { NotificationModel } from './notification.model';
export { NotificationTemplateModel } from './notification-template.model';
export { NotificationLogModel } from './notification-log.model';

export const __notificationsRegisteredModels = [
  NotificationModel.modelName,
  NotificationTemplateModel.modelName,
  NotificationLogModel.modelName,
] as const;
