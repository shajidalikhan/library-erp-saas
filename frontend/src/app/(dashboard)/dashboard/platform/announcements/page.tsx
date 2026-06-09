'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { platformApi } from '@/modules/platform/platform.service';

export default function PlatformAnnouncementsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const m = useMutation({
    mutationFn: () => platformApi.announcement({ title: title.trim(), message: message.trim(), type: 'ANNOUNCEMENT' }),
    onSuccess: (r) => {
      toast.success(`Queued for ${r.sent} recipients`);
      setTitle('');
      setMessage('');
    },
    onError: () => toast.error('Send failed'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Global announcements"
        description="Broadcast an in-app notification to every active user (platform-wide)."
      />
      <form
        className="max-w-lg space-y-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        <div className="space-y-1">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label>Message</Label>
          <textarea
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={m.isPending}>
          Send announcement
        </Button>
      </form>
    </div>
  );
}
