export const notificationsQueryKeys = {
  all: ['notifications'] as const,
  list: (q: Record<string, string | undefined>) => [...notificationsQueryKeys.all, 'list', q] as const,
  unread: () => [...notificationsQueryKeys.all, 'unread'] as const,
  templates: (q: Record<string, string | undefined>) => [...notificationsQueryKeys.all, 'templates', q] as const,
  logs: (q: Record<string, string | undefined>) => [...notificationsQueryKeys.all, 'logs', q] as const,
  logDetail: (logId: string) => [...notificationsQueryKeys.all, 'log', logId] as const,
  recipients: (q: Record<string, string | undefined>) => [...notificationsQueryKeys.all, 'recipients', q] as const,
};
