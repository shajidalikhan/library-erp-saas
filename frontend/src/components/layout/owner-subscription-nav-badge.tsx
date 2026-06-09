'use client';

import { ROLES } from '@/constants/permissions';
import { SubscriptionPlanBadge } from '@/modules/subscription/components/subscription-plan-badge';
import { useSubscriptionUsage } from '@/modules/subscription/hooks/use-subscription-usage';
import { selectUser, useAuthStore } from '@/store/auth.store';

/** Compact subscription badge in top navbar for library owners. */
export function OwnerSubscriptionNavBadge() {
  const user = useAuthStore(selectUser);
  const { snapshot } = useSubscriptionUsage();

  if (!user || user.role !== ROLES.LIBRARY_OWNER || !user.libraryId) return null;

  const snap = snapshot as Record<string, unknown> | undefined;
  const sub = snap?.subscription as { planCode?: string; badgeLabel?: string } | undefined;
  const planMeta = snap?.plan as { code?: string } | undefined;
  const planCode = String(planMeta?.code ?? sub?.planCode ?? '');

  return (
    <SubscriptionPlanBadge
      libraryId={user.libraryId}
      planCode={planCode}
      prefetchedSnapshot={snap}
      className="hidden sm:inline-flex"
    />
  );
}
