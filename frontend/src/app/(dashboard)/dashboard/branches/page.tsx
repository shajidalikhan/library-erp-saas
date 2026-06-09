'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { ROUTES, libraryBranchesRoute } from '@/constants/routes';
import { selectUser, useAuthStore } from '@/store/auth.store';

/**
 * Legacy `/dashboard/branches` entry — forwards to the library-scoped branches UI.
 */
export default function BranchesLegacyRedirectPage() {
  const router = useRouter();
  const user = useAuthStore(selectUser);

  useEffect(() => {
    if (user?.libraryId) {
      router.replace(libraryBranchesRoute(user.libraryId));
    } else {
      router.replace(ROUTES.LIBRARIES);
    }
  }, [router, user?.libraryId]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Redirecting…
    </div>
  );
}
