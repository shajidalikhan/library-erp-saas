'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { notificationsApi } from '@/modules/notifications/notifications.service';
import { notificationsQueryKeys } from '@/modules/notifications/notifications-query-keys';

export default function NotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const id = params?.id;

  const listQ = useQuery({
    queryKey: notificationsQueryKeys.list({ page: '1', limit: '50' }),
    queryFn: () => notificationsApi.list({ page: '1', limit: '50' }),
    enabled: Boolean(id) && can(PERMISSIONS.NOTIFICATION_READ),
  });

  const item = listQ.data?.data.items.find((x) => x._id === id);

  const markRead = useMutation({
    mutationFn: () => (id ? notificationsApi.markRead(id) : Promise.reject()),
    onSuccess: () => {
      toast.success('Marked as read');
      void qc.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
    onError: () => toast.error('Could not update'),
  });

  if (!can(PERMISSIONS.NOTIFICATION_READ)) {
    return <p className="text-sm text-muted-foreground">No access.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Notification" description="Details and metadata." />

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => router.push(ROUTES.NOTIFICATIONS)}>
          Back to inbox
        </Button>
        {item && !item.readAt ? (
          <Button type="button" size="sm" onClick={() => markRead.mutate()} disabled={markRead.isPending}>
            Mark read
          </Button>
        ) : null}
      </div>

      {listQ.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !item ? (
        <p className="text-sm text-muted-foreground">Notification not found or no longer available.</p>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{item.type}</Badge>
            <Badge variant="outline">{item.status}</Badge>
            {item.readAt ? <Badge variant="outline">Read</Badge> : <Badge>Unread</Badge>}
          </div>
          <h2 className="text-lg font-semibold">{item.title}</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.message}</p>
          <p className="text-xs text-muted-foreground">Sent {new Date(item.sentAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}
