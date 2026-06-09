'use client';

import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { BranchSelect } from '@/components/selectors/branch-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { NotificationRecipientSelect } from '@/components/selectors/notification-recipient-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { subscriptionFeatureErrorMessage } from '@/lib/feature-access';
import { ApiError } from '@/lib/api-error';
import { usePermissions } from '@/hooks/use-permissions';
import { useSubscriptionFeatures } from '@/modules/subscription/hooks/use-subscription-features';
import { selectUser, useAuthStore } from '@/store/auth.store';
import { notificationsApi } from '@/modules/notifications/notifications.service';
import { notificationsQueryKeys } from '@/modules/notifications/notifications-query-keys';
import type { NotificationType, SendTargetMode } from '@/modules/notifications/types';
import { NOTIFICATION_TYPES } from '@/modules/notifications/types';

type Audience = SendTargetMode;

export default function SendNotificationPage() {
  const qc = useQueryClient();
  const user = useAuthStore(selectUser);
  const { can } = usePermissions();
  const isSuper = user?.role === ROLES.SUPER_ADMIN;

  const [superLibraryId, setSuperLibraryId] = useState('');
  const effectiveLibraryId = isSuper ? superLibraryId : (user?.libraryId ?? '');
  const { canUseFeature: checkFeature } = useSubscriptionFeatures(effectiveLibraryId || user?.libraryId);
  const notificationsAccess = checkFeature('notifications', can(PERMISSIONS.NOTIFICATION_SEND));
  const managerBranchId = user?.role === ROLES.MANAGER ? (user?.branchId ?? '') : '';

  const [audience, setAudience] = useState<Audience>('USER');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [roleName, setRoleName] = useState<string>(ROLES.STUDENT);
  const [branchId, setBranchId] = useState('');
  const branchForTarget = managerBranchId || branchId;
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<NotificationType>('ANNOUNCEMENT');
  const [templateId, setTemplateId] = useState('');
  const [includeSelf, setIncludeSelf] = useState(false);

  const templatesQ = useQuery({
    queryKey: notificationsQueryKeys.templates({
      libraryId: effectiveLibraryId,
      page: '1',
      limit: '100',
    }),
    queryFn: () =>
      notificationsApi.listTemplates({
        libraryId: isSuper ? effectiveLibraryId || undefined : undefined,
        page: '1',
        limit: '100',
      }),
    enabled: can(PERMISSIONS.NOTIFICATION_SEND) && Boolean(effectiveLibraryId),
  });

  const sendM = useMutation({
    mutationFn: () => {
      const target: Record<string, unknown> = { mode: audience };
      if (audience === 'USER') target.userId = recipientUserId;
      if (audience === 'ROLE') target.role = roleName;
      if (audience === 'BRANCH') target.branchId = branchForTarget;

      const payload: Parameters<typeof notificationsApi.send>[0] = {
        title,
        message,
        type,
        target: target as never,
        includeSelf,
      };

      if (audience === 'PLATFORM') {
        // libraryId omitted — super only
      } else if (isSuper) {
        payload.libraryId = effectiveLibraryId;
      }

      if (!isSuper && audience === 'LIBRARY' && branchId) {
        payload.branchId = branchId;
      }
      if (isSuper && audience !== 'PLATFORM' && branchId) {
        payload.branchId = branchId;
      }

      return notificationsApi.send(payload);
    },
    onSuccess: (r) => {
      toast.success(`Sent to ${r.sent} recipient(s)`);
      void qc.invalidateQueries({ queryKey: notificationsQueryKeys.all });
    },
    onError: (err) => {
      const featureMsg = subscriptionFeatureErrorMessage(err);
      toast.error(featureMsg ?? (err instanceof ApiError ? err.message : 'Send failed'));
    },
  });

  const branchFilterForRecipients = useMemo(() => {
    if (user?.role === ROLES.MANAGER) return managerBranchId || undefined;
    if (audience === 'BRANCH' && branchId) return branchId;
    return undefined;
  }, [audience, branchId, managerBranchId, user?.role]);

  if (!can(PERMISSIONS.NOTIFICATION_SEND)) {
    return <p className="text-sm text-muted-foreground">You cannot send notifications.</p>;
  }

  const templates = templatesQ.data?.data.items ?? [];

  const needsLibrary = audience !== 'PLATFORM';
  const needsRecipient = audience === 'USER' && !recipientUserId.trim();
  const needsBranch = audience === 'BRANCH' && !branchForTarget.trim();
  const sendDisabled =
    sendM.isPending ||
    !notificationsAccess.allowed ||
    !title.trim() ||
    !message.trim() ||
    (needsLibrary && !effectiveLibraryId) ||
    needsRecipient ||
    needsBranch;

  const showIncludeSelf = audience !== 'USER';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Send notification"
        description="Choose audience with searchable users and branches. Library-wide sends exclude you by default."
      />

      {!notificationsAccess.allowed && !isSuper ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {notificationsAccess.reason}
        </p>
      ) : null}

      <form
        className="mx-auto max-w-xl space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          sendM.mutate();
        }}
      >
        {isSuper ? (
          <div className="space-y-2">
            <Label>Library context</Label>
            <LibrarySelect
              id="send-lib"
              label=""
              value={superLibraryId}
              onChange={(id) => {
                setSuperLibraryId(id);
                setRecipientUserId('');
                setBranchId('');
                setTemplateId('');
              }}
            />
            <p className="text-xs text-muted-foreground">
              Required for tenant sends. For platform-wide, pick audience &quot;Platform (all users)&quot; — library
              selection is optional for templates only.
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>Audience</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={audience}
            onChange={(e) => {
              setAudience(e.target.value as Audience);
              setRecipientUserId('');
            }}
          >
            <option value="USER">Individual user</option>
            <option value="ROLE">Role in library</option>
            <option value="BRANCH">Branch</option>
            <option value="LIBRARY">Whole library</option>
            <option value="STUDENTS_WITH_DUES">Students with dues</option>
            {isSuper ? <option value="PLATFORM">Platform (all users)</option> : null}
          </select>
        </div>

        {audience === 'USER' ? (
          <NotificationRecipientSelect
            libraryId={effectiveLibraryId || null}
            branchId={branchFilterForRecipients}
            value={recipientUserId}
            onChange={(id) => setRecipientUserId(id)}
            disabled={!effectiveLibraryId}
          />
        ) : null}

        {audience === 'ROLE' ? (
          <div className="space-y-2">
            <Label>Role</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            >
              {Object.values(ROLES).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {audience === 'BRANCH' ? (
          <BranchSelect
            id="send-branch"
            libraryId={effectiveLibraryId || null}
            value={branchForTarget}
            onChange={(id) => setBranchId(id)}
            disabled={!effectiveLibraryId || Boolean(managerBranchId)}
            lockedLibraryId={managerBranchId ? effectiveLibraryId : undefined}
            lockedBranchId={managerBranchId || undefined}
          />
        ) : null}

        {showIncludeSelf ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={includeSelf}
              onChange={(e) => setIncludeSelf(e.target.checked)}
            />
            Include me as a recipient
          </label>
        ) : null}

        <div className="space-y-2">
          <Label>Template (optional)</Label>
          {templatesQ.isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : templatesQ.isError ? (
            <p className="text-sm text-destructive">Could not load templates.</p>
          ) : (
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={templateId}
              onChange={(e) => {
                const id = e.target.value;
                setTemplateId(id);
                const tpl = templates.find((t) => t._id === id);
                if (tpl) {
                  setTitle(tpl.subject);
                  setMessage(tpl.body);
                }
              }}
            >
              <option value="">None — custom copy</option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} ({t.type})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="send-title">Title</Label>
          <Input id="send-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="send-msg">Message</Label>
          <textarea
            id="send-msg"
            className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={message}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            rows={5}
            maxLength={8000}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as NotificationType)}
          >
            {NOTIFICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <Button
          type="submit"
          disabled={sendDisabled}
          title={!notificationsAccess.allowed ? notificationsAccess.reason : undefined}
        >
          {sendM.isPending ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </div>
  );
}
