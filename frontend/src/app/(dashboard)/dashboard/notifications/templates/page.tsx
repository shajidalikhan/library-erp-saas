'use client';

import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { usePermissions } from '@/hooks/use-permissions';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { selectUser, useAuthStore } from '@/store/auth.store';
import { notificationsApi } from '@/modules/notifications/notifications.service';
import { notificationsQueryKeys } from '@/modules/notifications/notifications-query-keys';
import type { NotificationTemplateItem } from '@/modules/notifications/types';
import { NOTIFICATION_TYPES, type NotificationType } from '@/modules/notifications/types';

export default function NotificationTemplatesPage() {
  const qc = useQueryClient();
  const user = useAuthStore(selectUser);
  const { can } = usePermissions();
  const { effectiveLibraryId, requiresLibrarySelection, isSuperAdmin } = useTenantScope();
  const params = useMemo(() => ({ page: '1', limit: '50' }), []);
  const q = useQuery({
    queryKey: notificationsQueryKeys.templates(params),
    queryFn: () => notificationsApi.listTemplates(params),
    enabled: can(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE),
  });

  const [name, setName] = useState('');
  const [type, setType] = useState<NotificationType>('ANNOUNCEMENT');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [editing, setEditing] = useState<NotificationTemplateItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editActive, setEditActive] = useState(true);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const createM = useMutation({
    mutationFn: () =>
      notificationsApi.createTemplate({
        ...(isSuperAdmin && effectiveLibraryId ? { libraryId: effectiveLibraryId } : {}),
        name,
        type,
        subject,
        body,
        variables: [],
        active: true,
      }),
    onSuccess: () => {
      toast.success('Template saved');
      setName('');
      setSubject('');
      setBody('');
      void qc.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
    onError: () => toast.error('Could not save template'),
  });

  const updateM = useMutation({
    mutationFn: () => {
      if (!editing) return Promise.reject();
      return notificationsApi.updateTemplate(editing._id, {
        name: editName,
        subject: editSubject,
        body: editBody,
        active: editActive,
      });
    },
    onSuccess: () => {
      toast.success('Template updated');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
    onError: () => toast.error('Update failed'),
  });

  const delM = useMutation({
    mutationFn: (id: string) => notificationsApi.deleteTemplate(id),
    onSuccess: () => {
      toast.success('Deleted');
      setDeleteId(null);
      void qc.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
    onError: () => toast.error('Delete failed'),
  });

  if (!can(PERMISSIONS.NOTIFICATION_TEMPLATE_MANAGE)) {
    return <p className="text-sm text-muted-foreground">You cannot manage templates.</p>;
  }

  const items = q.data?.data.items ?? [];

  return (
    <div className="space-y-8">
      <PageHeader title="Templates" description="Reusable copy for fee reminders, announcements, and more." />

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">New template</h2>
        <form
          className="grid max-w-lg gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createM.mutate();
          }}
        >
          {isSuperAdmin ? (
            <p className="text-xs text-muted-foreground">
              Tenant templates use your selected library workspace (Seats page, Libraries, or{' '}
              <span className="font-mono">?libraryId=</span>).
              {requiresLibrarySelection ? ' Select library workspace first to attach this template to a tenant.' : null}
            </p>
          ) : null}
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <select
            className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as NotificationType)}
          >
            {NOTIFICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Input placeholder="Subject line" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Body (use {{var}} placeholders)"
            value={body}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)}
            rows={4}
            required
          />
          <Button
            type="submit"
            disabled={
              createM.isPending ||
              (!user?.libraryId && user?.role !== ROLES.SUPER_ADMIN) ||
              (isSuperAdmin && !effectiveLibraryId)
            }
          >
            Save template
          </Button>
        </form>
      </section>

      {q.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">Could not load templates.</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((t) => (
            <li key={t._id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.type} · {t.active ? 'active' : 'inactive'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(t);
                    setEditName(t.name);
                    setEditSubject(t.subject);
                    setEditBody(t.body);
                    setEditActive(t.active);
                  }}
                >
                  Edit
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteId(t._id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit template</DialogTitle>
            <DialogDescription>Update name, subject, body, or active state.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Body</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={updateM.isPending} onClick={() => updateM.mutate()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={delM.isPending}
              onClick={() => deleteId && delM.mutate(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
