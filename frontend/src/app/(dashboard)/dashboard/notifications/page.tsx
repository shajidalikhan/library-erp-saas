'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { notificationDetailRoute, ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { notificationsApi } from '@/modules/notifications/notifications.service';
import { notificationsQueryKeys } from '@/modules/notifications/notifications-query-keys';
import { NOTIFICATION_TYPES } from '@/modules/notifications/types';
import { cn } from '@/lib/utils';

export default function NotificationsInboxPage() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const user = useAuthStore(selectUser);
  const canRead = can(PERMISSIONS.NOTIFICATION_READ);
  const canSend = can(PERMISSIONS.NOTIFICATION_SEND);
  const showBroadcastCta = user?.role !== ROLES.STUDENT && canSend;
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const params = useMemo(
    () =>
      ({
        page: '1',
        limit: '25',
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(unreadOnly ? { unreadOnly: 'true' } : {}),
      }) as Record<string, string | undefined>,
    [type, status, unreadOnly],
  );

  const listQ = useQuery({
    queryKey: notificationsQueryKeys.list(params),
    queryFn: () => notificationsApi.list(params),
    enabled: canRead,
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (r) => {
      toast.success(`Marked ${r.modified} as read`);
      void qc.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
    onError: () => toast.error('Could not mark all read'),
  });

  if (!canRead) {
    return <p className="text-sm text-muted-foreground">You do not have access to notifications.</p>;
  }

  const items = listQ.data?.data.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="In-app messages, reminders, and announcements for your library."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All types</option>
            {NOTIFICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="SENT">SENT</option>
            <option value="PENDING">PENDING</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
          Unread only
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
          Mark all read
        </Button>
      </div>

      {listQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : listQ.isError ? (
        <p className="text-sm text-destructive">Could not load notifications.</p>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No notifications match your filters.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((n) => (
            <li key={n._id}>
              <Link
                href={notificationDetailRoute(n._id)}
                className={cn(
                  'flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center sm:justify-between',
                  !n.readAt && 'bg-primary/5',
                )}
              >
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{n.message}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant="secondary">{n.type}</Badge>
                  {!n.readAt ? <Badge variant="default">Unread</Badge> : null}
                  <span className="text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showBroadcastCta ? (
        <p className="text-xs text-muted-foreground">
          Need to broadcast?{' '}
          <Link href={ROUTES.NOTIFICATIONS_SEND} className="text-primary underline-offset-4 hover:underline">
            Send a notification
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
