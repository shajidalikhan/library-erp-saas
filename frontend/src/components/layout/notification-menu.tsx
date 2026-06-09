'use client';

import { Bell, BellRing } from 'lucide-react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ROUTES, notificationDetailRoute } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { notificationsApi } from '@/modules/notifications/notifications.service';
import { notificationsQueryKeys } from '@/modules/notifications/notifications-query-keys';

export function NotificationMenu() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const enabled = can(PERMISSIONS.NOTIFICATION_READ);

  const unreadQ = useQuery({
    queryKey: notificationsQueryKeys.unread(),
    queryFn: () => notificationsApi.unreadCount(),
    enabled,
    refetchInterval: 60_000,
  });

  const latestQ = useQuery({
    queryKey: notificationsQueryKeys.list({ page: '1', limit: '5' }),
    queryFn: () => notificationsApi.list({ page: '1', limit: '5' }),
    enabled,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: notificationsQueryKeys.all }),
  });

  const count = unreadQ.data?.count ?? 0;
  const items = latestQ.data?.data.items ?? [];

  if (!enabled) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Open notifications"
        >
          {count > 0 ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground ring-2 ring-background">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <span className="text-xs text-muted-foreground">
            {count === 0 ? 'All caught up' : `${count} unread`}
          </span>
        </div>
        <Separator />

        {latestQ.isLoading ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <Bell className="h-4 w-4" />
            </div>
            <p className="mt-3 text-sm font-medium">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground">New activity will appear here.</p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1 scrollbar-thin">
            {items.map((n) => (
              <li key={n._id}>
                <Link
                  href={notificationDetailRoute(n._id)}
                  className="block px-4 py-3 hover:bg-accent"
                  onClick={() => {
                    if (!n.readAt) markOne.mutate(n._id);
                  }}
                >
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Separator />
        <Link
          href={ROUTES.NOTIFICATIONS}
          className="block py-2.5 text-center text-xs font-medium text-primary hover:underline"
        >
          View inbox
        </Link>
      </PopoverContent>
    </Popover>
  );
}
