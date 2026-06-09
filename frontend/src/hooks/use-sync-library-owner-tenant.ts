'use client';

import { useQuery } from '@tanstack/react-query';

import { ROLES } from '@/constants/permissions';
import { authService } from '@/modules/auth/auth.service';
import { useAuthStore } from '@/store/auth.store';

/**
 * Refetches `/auth/me` when a library owner is missing `libraryId` so the
 * client matches server backfill (owned library linked to the user).
 */
export function useLibraryOwnerTenantSync(): { needsSync: boolean; isFetching: boolean } {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const needsSync = Boolean(user?.id && user.role === ROLES.LIBRARY_OWNER && !user.libraryId);

  const { isFetching } = useQuery({
    queryKey: ['library-owner-tenant', user?.id],
    queryFn: async () => {
      const u = await authService.me();
      setUser(u);
      return u;
    },
    enabled: needsSync,
    staleTime: 0,
    retry: false,
  });

  return { needsSync, isFetching };
}
