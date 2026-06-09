import type { QueryClient } from '@tanstack/react-query';

import { analyticsQueryKeys } from '@/modules/analytics/analytics-query-keys';
import { publicPricingPlansQueryKey } from '@/modules/marketing/hooks/use-public-pricing-plans';
import { platformQueryKeys } from '@/modules/platform/platform-query-keys';
import { platformSupportQueryKey } from '@/hooks/use-platform-support-config';
import { subscriptionQueryKeys } from '@/modules/subscription/subscription-query-keys';

/** Invalidate all subscription-related caches after billing mutations. */
export async function invalidateSubscriptionQueries(
  qc: QueryClient,
  libraryId?: string | null,
): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: subscriptionQueryKeys.all }),
    qc.invalidateQueries({ queryKey: ['billing'] }),
    qc.invalidateQueries({ queryKey: platformQueryKeys.all }),
    qc.invalidateQueries({ queryKey: platformQueryKeys.plans() }),
    qc.invalidateQueries({ queryKey: platformSupportQueryKey }),
    qc.invalidateQueries({ queryKey: analyticsQueryKeys.all }),
    qc.invalidateQueries({ queryKey: ['activity', 'recent'] }),
    qc.invalidateQueries({ queryKey: ['dashboard'] }),
    qc.invalidateQueries({ queryKey: publicPricingPlansQueryKey }),
    qc.invalidateQueries({ queryKey: ['auth', 'me'] }),
  ]);
  await Promise.all([
    qc.refetchQueries({ queryKey: platformQueryKeys.plans() }),
    qc.refetchQueries({ queryKey: platformQueryKeys.all }),
    qc.refetchQueries({ queryKey: ['libraries'] }),
  ]);
  if (libraryId) {
    await Promise.all([
      qc.invalidateQueries({ queryKey: platformQueryKeys.tenant(libraryId) }),
      qc.invalidateQueries({ queryKey: subscriptionQueryKeys.librarySnapshot(libraryId) }),
      qc.invalidateQueries({ queryKey: subscriptionQueryKeys.effectiveFeatures(libraryId) }),
      qc.invalidateQueries({ queryKey: subscriptionQueryKeys.ownerSnapshot(libraryId) }),
      qc.invalidateQueries({ queryKey: subscriptionQueryKeys.libraryTimeline(libraryId) }),
    ]);
    await qc.refetchQueries({ queryKey: subscriptionQueryKeys.librarySnapshot(libraryId) });
    await qc.refetchQueries({ queryKey: subscriptionQueryKeys.effectiveFeatures(libraryId) });
    await qc.refetchQueries({ queryKey: subscriptionQueryKeys.ownerSnapshot(libraryId) });
    await qc.refetchQueries({ queryKey: platformQueryKeys.tenant(libraryId) });
  }
}
