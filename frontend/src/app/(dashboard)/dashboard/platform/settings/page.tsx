'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { platformSupportQueryKey } from '@/hooks/use-platform-support-config';
import { platformApi } from '@/modules/platform/platform.service';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';

export default function PlatformSettingsPage() {
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
  const [whatsappSupport, setWhatsappSupport] = useState('');
  const [showSupportEmail, setShowSupportEmail] = useState(true);
  const [showSupportPhone, setShowSupportPhone] = useState(true);
  const [showWhatsappSupport, setShowWhatsappSupport] = useState(false);
  const [showSalesEmail, setShowSalesEmail] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    if (q.data) {
      setSupportEmail(String(q.data.supportEmail ?? ''));
      setSalesEmail(String(q.data.salesEmail ?? ''));
      setDemoRequestNotifyEmail(String(q.data.demoRequestNotifyEmail ?? ''));
      setSupportPhone(String(q.data.supportPhone ?? ''));
      setBillingPhone(String(q.data.billingPhone ?? ''));
      setWhatsappSupport(String(q.data.whatsappSupport ?? ''));
      setShowSupportEmail(q.data.showSupportEmail !== false);
      setShowSupportPhone(q.data.showSupportPhone !== false);
      setShowWhatsappSupport(Boolean(q.data.showWhatsappSupport));
      setShowSalesEmail(q.data.showSalesEmail !== false);
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
        whatsappSupport: whatsappSupport.trim(),
        showSupportEmail,
        showSupportPhone,
        showWhatsappSupport,
        showSalesEmail,
        maintenanceMode,
      }),
    onSuccess: () => {
      toast.success('Platform settings saved');
      void qc.invalidateQueries({ queryKey: platformQueryKeys.settings() });
      void qc.invalidateQueries({ queryKey: platformSupportQueryKey });
    },
    onError: () => toast.error('Could not save platform settings'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        description="Support contacts, demo lead notifications, and maintenance mode."
      />
      {q.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load settings.</p>
      ) : (
        <form
          className="max-w-xl space-y-5 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="demoRequestNotifyEmail">Demo request notification email</Label>
            <Input
              id="demoRequestNotifyEmail"
              type="email"
              value={demoRequestNotifyEmail}
              onChange={(e) => setDemoRequestNotifyEmail(e.target.value)}
              placeholder="leads@libraryerp.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supportEmail">Support email</Label>
            <Input
              id="supportEmail"
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              placeholder="support@libraryerp.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="salesEmail">Sales email</Label>
            <Input
              id="salesEmail"
              type="email"
              value={salesEmail}
              onChange={(e) => setSalesEmail(e.target.value)}
              placeholder="sales@libraryerp.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="supportPhone">Support phone</Label>
            <Input
              id="supportPhone"
              type="tel"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="+91 …"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="billingPhone">Billing phone</Label>
            <Input
              id="billingPhone"
              type="tel"
              value={billingPhone}
              onChange={(e) => setBillingPhone(e.target.value)}
              placeholder="+91 …"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsappSupport">WhatsApp support number</Label>
            <Input
              id="whatsappSupport"
              type="tel"
              value={whatsappSupport}
              onChange={(e) => setWhatsappSupport(e.target.value)}
              placeholder="+91 …"
            />
          </div>
          <fieldset className="space-y-2 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Support visibility (tenant UI)</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showSupportEmail} onChange={(e) => setShowSupportEmail(e.target.checked)} />
              Show support email
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showSupportPhone} onChange={(e) => setShowSupportPhone(e.target.checked)} />
              Show support phone
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showWhatsappSupport} onChange={(e) => setShowWhatsappSupport(e.target.checked)} />
              Show WhatsApp support
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showSalesEmail} onChange={(e) => setShowSalesEmail(e.target.checked)} />
              Show sales email
            </label>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} />
            Maintenance mode
          </label>
          <Button type="submit" loading={m.isPending}>
            Save settings
          </Button>
        </form>
      )}
    </div>
  );
}
