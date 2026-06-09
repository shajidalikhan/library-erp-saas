'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

export default function SettingsPlatformPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: platformQueryKeys.settings(),
    queryFn: () => platformApi.settings(),
  });

  const [supportEmail, setSupportEmail] = useState('');
  const [salesEmail, setSalesEmail] = useState('');
  const [demoRequestNotifyEmail, setDemoRequestNotifyEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    if (q.data) {
      setSupportEmail(String(q.data.supportEmail ?? ''));
      setSalesEmail(String(q.data.salesEmail ?? ''));
      setDemoRequestNotifyEmail(String(q.data.demoRequestNotifyEmail ?? ''));
      setSupportPhone(String(q.data.supportPhone ?? ''));
      setBillingPhone(String(q.data.billingPhone ?? ''));
      setMaintenanceMode(Boolean(q.data.maintenanceMode));
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: () =>
      platformApi.patchSettings({
        supportEmail: supportEmail.trim(),
        salesEmail: salesEmail.trim(),
        demoRequestNotifyEmail: demoRequestNotifyEmail.trim(),
        supportPhone: supportPhone.trim(),
        billingPhone: billingPhone.trim(),
        maintenanceMode,
      }),
    onSuccess: () => {
      toast.success('Platform settings saved');
      void qc.invalidateQueries({ queryKey: platformQueryKeys.settings() });
    },
    onError: () => toast.error('Could not save platform settings'),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full max-w-xl" />;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Platform settings</CardTitle>
        <CardDescription>Support contacts, demo notifications, and maintenance mode.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="supportEmail">Support email</Label>
            <Input id="supportEmail" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salesEmail">Sales email</Label>
            <Input id="salesEmail" type="email" value={salesEmail} onChange={(e) => setSalesEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="demoEmail">Demo request notification email</Label>
            <Input
              id="demoEmail"
              type="email"
              value={demoRequestNotifyEmail}
              onChange={(e) => setDemoRequestNotifyEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supportPhone">Support phone</Label>
            <Input
              id="supportPhone"
              type="tel"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billingPhone">Billing phone</Label>
            <Input
              id="billingPhone"
              type="tel"
              value={billingPhone}
              onChange={(e) => setBillingPhone(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} />
            Maintenance mode
          </label>
          <Button type="submit" disabled={m.isPending}>
            Save platform settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
