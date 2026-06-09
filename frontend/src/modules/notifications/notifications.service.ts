import { request, requestDataAndMeta } from '@/lib/axios';

import type {
  NotificationLogDetail,
  NotificationLogItem,
  NotificationRecipientRow,
  NotificationTemplateItem,
  PaginatedNotifications,
  SendNotificationPayload,
} from './types';

function cleanParams(p?: Record<string, string | undefined>): Record<string, string> | undefined {
  if (!p) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== '') out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export const notificationsApi = {
  list: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<PaginatedNotifications>({
      url: '/notifications',
      method: 'GET',
      params: cleanParams(params),
    }),

  unreadCount: () => request<{ count: number }>({ url: '/notifications/unread-count', method: 'GET' }),

  markRead: (notificationId: string) =>
    request<{ ok: boolean }>({ url: `/notifications/${notificationId}/read`, method: 'PATCH' }),

  markAllRead: () => request<{ modified: number }>({ url: '/notifications/read-all', method: 'PATCH' }),

  send: (body: SendNotificationPayload) =>
    request<{ sent: number }>({ url: '/notifications/send', method: 'POST', data: body }),

  bulkSend: (body: { libraryId?: string; branchId?: string; items: SendNotificationPayload[] }) =>
    request<{ sent: number }>({ url: '/notifications/bulk-send', method: 'POST', data: body }),

  listTemplates: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<{ items: NotificationTemplateItem[]; meta: PaginatedNotifications['meta'] }>({
      url: '/notifications/templates',
      method: 'GET',
      params: cleanParams(params),
    }),

  createTemplate: (body: {
    libraryId?: string;
    branchId?: string;
    name: string;
    type: string;
    subject: string;
    body: string;
    variables?: string[];
    active?: boolean;
  }) => request<{ template: NotificationTemplateItem & { _id: string } }>({
    url: '/notifications/templates',
    method: 'POST',
    data: body,
  }),

  updateTemplate: (
    templateId: string,
    body: Partial<{
      name: string;
      type: string;
      subject: string;
      body: string;
      variables: string[];
      active: boolean;
    }>,
  ) =>
    request<{ template: NotificationTemplateItem & { _id: string } }>({
      url: `/notifications/templates/${templateId}`,
      method: 'PATCH',
      data: body,
    }),

  deleteTemplate: (templateId: string) =>
    request<{ ok: boolean }>({ url: `/notifications/templates/${templateId}`, method: 'DELETE' }),

  listLogs: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<{ items: NotificationLogItem[]; meta: PaginatedNotifications['meta'] }>({
      url: '/notifications/logs',
      method: 'GET',
      params: cleanParams(params),
    }),

  getLogDetail: (logId: string) =>
    request<NotificationLogDetail>({ url: `/notifications/logs/${logId}`, method: 'GET' }),

  listRecipients: (params?: Record<string, string | undefined>) =>
    requestDataAndMeta<{
      items: NotificationRecipientRow[];
      meta: PaginatedNotifications['meta'];
    }>({
      url: '/notifications/recipients',
      method: 'GET',
      params: cleanParams(params),
    }),
};
