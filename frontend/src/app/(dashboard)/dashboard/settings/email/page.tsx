'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { settingsApi } from '@/modules/settings/settings.service';
import { settingsQueryKeys } from '@/modules/settings/settings-query-keys';

export default function SettingsEmailPage() {
  const q = useQuery({
    queryKey: settingsQueryKeys.email(),
    queryFn: () => settingsApi.getEmailSettings(),
  });

  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState('Library ERP test email');

  useEffect(() => {
    if (q.data?.supportEmail && !testTo) {
      setTestTo(q.data.supportEmail);
    }
  }, [q.data, testTo]);

  const sendTest = useMutation({
    mutationFn: () =>
      settingsApi.sendTestEmail({
        to: testTo.trim(),
        subject: testSubject.trim(),
      }),
    onSuccess: () => toast.success('Test email sent'),
    onError: () => toast.error('Could not send test email'),
  });

  if (q.isLoading) return <Skeleton className="h-72 w-full max-w-xl" />;
  if (q.isError) return <p className="text-sm text-destructive">Could not load email settings.</p>;

  const data = q.data!;

  return (
    <div className="space-y-6 max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>SMTP status</CardTitle>
          <CardDescription>Credentials are configured via server environment variables only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={data.smtpConfigured ? 'default' : 'secondary'}>
              {data.smtpConfigured ? 'Configured' : 'Not configured'}
            </Badge>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">From</span>
            <span className="text-right font-mono text-xs">{data.smtpFrom ?? '—'}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Host</span>
            <span className="font-mono text-xs">{data.smtpHost ?? '—'}:{data.smtpPort}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Secure</span>
            <span>{data.smtpSecure ? 'Yes' : 'No'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification addresses</CardTitle>
          <CardDescription>Used for demo requests and platform contact (edit in Platform settings).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Support:</span> {data.supportEmail || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Sales:</span> {data.salesEmail || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Demo requests:</span> {data.demoRequestNotifyEmail || '—'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send test email</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              sendTest.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="testTo">Recipient</Label>
              <Input id="testTo" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="testSubject">Subject</Label>
              <Input id="testSubject" value={testSubject} onChange={(e) => setTestSubject(e.target.value)} />
            </div>
            <Button type="submit" disabled={sendTest.isPending}>
              {sendTest.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send test'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
