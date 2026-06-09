'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ROLES } from '@/constants/permissions';
import { useAuthStore, selectUser } from '@/store/auth.store';
import type { LibrarySubmitOptions } from '@/modules/library/components/library-form';
import { LibraryForm } from '@/modules/library/components/library-form';
import { MembershipSettingsCard } from '@/modules/library/components/membership-settings-card';
import { libraryApi } from '@/modules/library/library.service';
import { libraryQueryKeys } from '@/modules/library/library-query-keys';

export default function SettingsOrganizationPage() {
  const user = useAuthStore(selectUser);
  const libraryId = user?.libraryId;
  const qc = useQueryClient();

  const { data: library, isLoading, error } = useQuery({
    queryKey: libraryQueryKeys.library(libraryId ?? ''),
    queryFn: () => libraryApi.getLibrary(libraryId!),
    enabled: Boolean(libraryId) && user?.role === ROLES.LIBRARY_OWNER,
  });

  if (user?.role !== ROLES.LIBRARY_OWNER) {
    return <EmptyState title="Not available" description="Organization settings are for library owners." />;
  }

  if (!libraryId) {
    return <EmptyState title="No library" description="Your account is not linked to a library." />;
  }

  if (error) {
    return <EmptyState title="Error" description="Could not load library settings." />;
  }

  if (isLoading || !library) {
    return <Skeleton className="h-96 w-full max-w-2xl rounded-xl" />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <LibraryForm
        mode="edit"
        initial={library}
        showOwnerField={false}
        showSlugField={false}
        showPlanAndStatus={false}
        showSettingsJson={false}
        submitLabel="Save library"
        onSubmit={async (payload, opts?: LibrarySubmitOptions) => {
          const body =
            opts?.logoFile != null
              ? (() => {
                  const fd = new FormData();
                  fd.append('payload', JSON.stringify(payload));
                  fd.append('logo', opts.logoFile);
                  return fd;
                })()
              : payload;

          await libraryApi.updateLibrary(library._id, body);
          toast.success('Library settings saved');
          void qc.invalidateQueries({ queryKey: libraryQueryKeys.library(library._id) });
        }}
      />
      <MembershipSettingsCard library={library} />
    </div>
  );
}
