'use client';

import {
  Activity,
  Armchair,
  Bell,
  Building2,
  ClipboardCheck,
  CreditCard,
  FileText,
  UserPlus,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { useTenantScope } from '@/hooks/use-tenant-scope';
import { activityApi } from '@/modules/activity/activity.service';
import type { ActivityEventType } from '@/modules/activity/types';

const ICONS: Record<ActivityEventType, typeof Activity> = {
  student_created: UserPlus,
  student_updated: Users,
  seat_assigned: Armchair,
  seat_unassigned: Armchair,
  check_in: ClipboardCheck,
  check_out: ClipboardCheck,
  invoice_created: FileText,
  payment_collected: CreditCard,
  notification_sent: Bell,
  branch_created: Building2,
  user_created: UserPlus,
  tenant_updated: Building2,
  tenant_suspended: Building2,
  tenant_activated: Building2,
  login: Activity,
  other: Activity,
};

export function RecentActivityFeed() {
  const { isSuperAdmin, effectiveLibraryId, effectiveBranchId } = useTenantScope();
  const params = {
    page: 1,
    limit: 12,
    ...(isSuperAdmin && effectiveLibraryId ? { libraryId: effectiveLibraryId } : {}),
    ...(isSuperAdmin && effectiveBranchId ? { branchId: effectiveBranchId } : {}),
  };
  const { data, isLoading, isError } = useQuery({
    queryKey: ['activity', 'recent', params],
    queryFn: () => activityApi.recent(params),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">Could not load recent activity. Try again shortly.</p>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No recent activity"
        description="Actions like student admissions, check-ins, and payments will appear here."
      />
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {items.map((item) => {
        const Icon = ICONS[item.type] ?? Activity;
        const when = formatRelativeTime(item.createdAt);
        const context = [item.branchName, item.libraryName].filter(Boolean).join(' · ');
        return (
          <li key={item.id} className="flex gap-3 px-4 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{item.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {item.actorName ? `${item.actorName} · ` : ''}
                {when}
                {context ? ` · ${context}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
