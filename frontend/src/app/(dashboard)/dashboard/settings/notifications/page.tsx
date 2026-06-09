'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { settingsApi } from '@/modules/settings/settings.service';
import { settingsQueryKeys } from '@/modules/settings/settings-query-keys';

export default function SettingsNotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: settingsQueryKeys.notifications(),
    queryFn: () => settingsApi.getNotificationPreferences(),
  });

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);

  useEffect(() => {
    if (q.data) {
      setEmailEnabled(q.data.emailEnabled);
      setInAppEnabled(q.data.inAppEnabled);
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => settingsApi.patchNotificationPreferences({ emailEnabled, inAppEnabled }),
    onSuccess: () => {
      toast.success('Notification preferences saved');
      void qc.invalidateQueries({ queryKey: settingsQueryKeys.notifications() });
    },
    onError: () => toast.error('Could not save preferences'),
  });

  if (q.isLoading) return <Skeleton className="h-48 w-full max-w-xl" />;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose how you receive alerts and updates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>Email notifications</span>
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => setEmailEnabled(e.target.checked)}
            className="h-4 w-4"
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>In-app notifications</span>
          <input
            type="checkbox"
            checked={inAppEnabled}
            onChange={(e) => setInAppEnabled(e.target.checked)}
            className="h-4 w-4"
          />
        </label>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save preferences'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
