/** Centralized React Query keys for SaaS subscription snapshot data. */
export const subscriptionQueryKeys = {
  all: ['subscription'] as const,
  effectiveFeatures: (libraryId: string) =>
    [...subscriptionQueryKeys.all, 'effective-features', libraryId] as const,
  ownerSnapshot: (libraryId: string) =>
    [...subscriptionQueryKeys.all, 'owner-snapshot', libraryId] as const,
  librarySnapshot: (libraryId: string) =>
    [...subscriptionQueryKeys.all, 'library-snapshot', libraryId] as const,
  libraryTimeline: (libraryId: string) =>
    [...subscriptionQueryKeys.all, 'library-timeline', libraryId] as const,
};
