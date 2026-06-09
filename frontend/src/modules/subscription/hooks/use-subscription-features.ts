'use client';

import { useMemo } from 'react';

import { billingApi } from '@/modules/billing/billing.service';
import { platformApi } from '@/modules/platform/platform.service';
import { mergeEffectiveFeatures } from '@/lib/effective-features';
import { canUseFeature as evaluateFeatureAccess } from '@/lib/feature-access';
import { catalogFeatureLabel } from '@/modules/subscription/subscription-feature-catalog';
import { subscriptionQueryKeys } from '@/modules/subscription/subscription-query-keys';
import { ROLES } from '@/constants/permissions';
import { selectUser, useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';

export function useSubscriptionFeatures(libraryId?: string | null) {
  const user = useAuthStore(selectUser);
  const resolvedLibraryId = libraryId ?? user?.libraryId ?? null;
  const owner =
    user?.role === ROLES.LIBRARY_OWNER &&
    Boolean(resolvedLibraryId && user.libraryId === resolvedLibraryId);
  const platform = user?.role === ROLES.SUPER_ADMIN && Boolean(resolvedLibraryId);
  const tenantUser = Boolean(resolvedLibraryId && user?.libraryId === resolvedLibraryId);

  const q = useQuery({
    queryKey: tenantUser
      ? subscriptionQueryKeys.effectiveFeatures(resolvedLibraryId!)
      : ['features', 'none'],
    queryFn: async () => {
      if (tenantUser) return billingApi.effectiveFeatures();
      if (platform && resolvedLibraryId) return platformApi.subscriptionSnapshot(resolvedLibraryId);
      return null;
    },
    enabled: Boolean((tenantUser || platform) && resolvedLibraryId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const fromAuth = user?.effectiveFeatures ?? user?.subscriptionFeatures;
  const enabledOverrides = user?.enabledFeaturesOverride;
  const disabledOverrides = user?.disabledFeaturesOverride;

  const features = useMemo(
    () =>
      mergeEffectiveFeatures({
        fromAuth,
        snapshot: q.data as Record<string, unknown> | undefined,
        snapshotReady: q.isFetched && !q.isError,
        enabledFeaturesOverride: enabledOverrides,
        disabledFeaturesOverride: disabledOverrides,
      }),
    [fromAuth, enabledOverrides, disabledOverrides, q.data, q.isFetched, q.isError],
  );

  const planName = useMemo(() => {
    const snap = q.data as Record<string, unknown> | undefined;
    const access = snap?.featureAccess as { planName?: string } | undefined;
    const plan = snap?.plan as { displayName?: string; code?: string } | undefined;
    return plan?.displayName ?? access?.planName ?? user?.subscriptionPlanName ?? '';
  }, [q.data, user?.subscriptionPlanName]);

  const hasFeature = (key: string): boolean => Boolean(features[key]);

  const canUseFeature = (key: string, hasPermission = true) =>
    evaluateFeatureAccess(features, key, hasPermission, planName);

  const canUseFeatureLegacy = (key: string, hasPermission: boolean): boolean =>
    hasPermission && hasFeature(key);

  const featureAccess = (q.data as Record<string, unknown> | undefined)?.featureAccess as
    | {
        planFeatures?: Record<string, boolean>;
        features?: Record<string, boolean>;
        enabledFeaturesOverride?: string[];
        disabledFeaturesOverride?: string[];
        included?: Array<{ key: string; label: string }>;
        unavailable?: Array<{ key: string; label: string }>;
      }
    | undefined;

  return {
    features,
    planName,
    featureAccess,
    enabledFeaturesOverride:
      featureAccess?.enabledFeaturesOverride ?? enabledOverrides ?? [],
    disabledFeaturesOverride:
      featureAccess?.disabledFeaturesOverride ?? disabledOverrides ?? [],
    isLoading: q.isLoading,
    isFetched: q.isFetched,
    isError: q.isError,
    hasFeature,
    canUseFeature,
    canUseFeatureLegacy,
    featureLabel: catalogFeatureLabel,
    refetch: q.refetch,
  };
}
