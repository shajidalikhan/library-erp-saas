'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { settingsApi, type EmailTemplate } from '../settings.service';
import { settingsQueryKeys } from '../settings-query-keys';

const SAMPLE_VARS: Record<string, Record<string, string>> = {
  forgot_password: {
    fullName: 'Alex Kumar',
    resetUrl: 'https://app.libraryerp.in/reset-password?token=sample',
    expiresIn: '30 minutes',
  },
  demo_request_received: {
    fullName: 'Priya Sharma',
    phone: '+91 98765 43210',
    email: 'priya@example.com',
    libraryName: 'Sunrise Study Library',
    city: 'Jaipur',
    branchCount: '2',
    studentCount: '120',
    currentSystem: 'Excel',
    interestedFeatures: 'Seats, Payments',
    notes: 'Interested in annual plan',
    submittedAt: new Date().toISOString(),
  },
};

export function EmailTemplatesEditor() {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: settingsQueryKeys.emailTemplates(),
    queryFn: () => settingsApi.listEmailTemplates(),
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState('');
  const [textBody, setTextBody] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedKey && listQ.data?.length) {
      setSelectedKey(listQ.data[0].key);
    }
  }, [listQ.data, selectedKey]);

  const detailQ = useQuery({
    queryKey: settingsQueryKeys.emailTemplate(selectedKey ?? ''),
    queryFn: () => settingsApi.getEmailTemplate(selectedKey!),
    enabled: Boolean(selectedKey),
  });

  useEffect(() => {
    if (detailQ.data) {
      setSubject(detailQ.data.subject);
      setHtmlBody(detailQ.data.htmlBody);
      setTextBody(detailQ.data.textBody);
      setVariables(detailQ.data.variables ?? []);
      setPreviewHtml(null);
    }
  }, [detailQ.data]);

  const save = useMutation({
    mutationFn: () =>
      settingsApi.patchEmailTemplate(selectedKey!, { subject, htmlBody, textBody }),
    onSuccess: () => {
      toast.success('Template saved');
      void qc.invalidateQueries({ queryKey: settingsQueryKeys.emailTemplates() });
      if (selectedKey) {
        void qc.invalidateQueries({ queryKey: settingsQueryKeys.emailTemplate(selectedKey) });
      }
    },
    onError: () => toast.error('Could not save template'),
  });

  const reset = useMutation({
    mutationFn: () => settingsApi.resetEmailTemplate(selectedKey!),
    onSuccess: (tpl) => {
      setSubject(tpl.subject);
      setHtmlBody(tpl.htmlBody);
      setTextBody(tpl.textBody);
      setVariables(tpl.variables ?? []);
      toast.success('Reset to default');
    },
    onError: () => toast.error('Could not reset template'),
  });

  const preview = useMutation({
    mutationFn: () =>
      settingsApi.previewEmailTemplate(selectedKey!, {
        subject,
        htmlBody,
        textBody,
        variables: SAMPLE_VARS[selectedKey!] ?? {},
      }),
    onSuccess: (p) => setPreviewHtml(p.html),
    onError: () => toast.error('Could not preview'),
  });

  if (listQ.isLoading) return <Skeleton className="h-96 w-full" />;

  const templates = listQ.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 p-2 pt-0">
          {templates.map((t: EmailTemplate) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSelectedKey(t.key)}
              className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedKey === t.key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
              }`}
            >
              {t.name}
            </button>
          ))}
        </CardContent>
      </Card>

      {selectedKey && detailQ.data ? (
        <Card>
          <CardHeader>
            <CardTitle>{detailQ.data.name}</CardTitle>
            <CardDescription>
              Variables:{' '}
              {variables.map((v) => (
                <code key={v} className="mr-1 rounded bg-muted px-1 text-xs">{`{{${v}}}`}</code>
              ))}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="htmlBody">HTML body</Label>
              <textarea
                id="htmlBody"
                className="min-h-[180px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="textBody">Plain text body</Label>
              <textarea
                id="textBody"
                className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
              />
            </div>
            {previewHtml ? (
              <div className="rounded-md border p-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Preview</p>
                <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
              <Button type="button" variant="outline" onClick={() => preview.mutate()} disabled={preview.isPending}>
                Preview
              </Button>
              <Button type="button" variant="secondary" onClick={() => reset.mutate()} disabled={reset.isPending}>
                Reset to default
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Skeleton className="h-96 w-full" />
      )}
    </div>
  );
}
