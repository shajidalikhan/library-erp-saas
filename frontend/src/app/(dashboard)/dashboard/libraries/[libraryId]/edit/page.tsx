'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS, ROLES } from '@/constants/permissions';
import { ROUTES, libraryDetailRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { ApiError } from '@/lib/api-error';
import type { LibrarySubmitOptions } from '@/modules/library/components/library-form';
import { LibraryForm } from '@/modules/library/components/library-form';
import { libraryApi } from '@/modules/library/library.service';
import { libraryQueryKeys } from '@/modules/library/library-query-keys';
import { DangerZoneSection } from '@/components/common/danger-zone-section';
import { DeleteLibraryDialog } from '@/modules/library/components/delete-library-dialog';

export default function EditLibraryPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const user = useAuthStore(selectUser);

  const { data: library, isLoading, error } = useQuery({
    queryKey: libraryQueryKeys.library(libraryId),
    queryFn: () => libraryApi.getLibrary(libraryId),
    enabled: Boolean(libraryId) && can(PERMISSIONS.LIBRARY_READ),
  });

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!can(PERMISSIONS.LIBRARY_UPDATE)) {
    return <EmptyState title="No access" description="You cannot edit libraries." />;
  }

  if (error) {
    const msg = error instanceof ApiError ? error.message : 'Failed to load';
    return <EmptyState title="Error" description={msg} />;
  }

  if (isLoading || !library) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${library.name}`}
        description={
          isSuperAdmin
            ? 'Update tenant profile, plan, and structured settings.'
            : 'Manage your library profile and operational settings.'
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={libraryDetailRoute(library._id)}>Cancel</Link>
          </Button>
        }
      />
      <LibraryForm
        mode="edit"
        initial={library}
        showOwnerField={isSuperAdmin}
        showSlugField={isSuperAdmin}
        showPlanAndStatus={isSuperAdmin}
        showSettingsJson={false}
        onSubmit={async (payload, opts?: LibrarySubmitOptions) => {
          try {
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
            toast.success('Library saved');
            await queryClient.invalidateQueries({ queryKey: libraryQueryKeys.library(library._id) });
            await queryClient.invalidateQueries({ queryKey: ['libraries'] });
            router.push(libraryDetailRoute(library._id));
          } catch (e) {
            if (e instanceof ApiError) toast.error(e.message);
            else toast.error('Save failed');
            throw e;
          }
        }}
      />
      {isSuperAdmin && can(PERMISSIONS.LIBRARY_DELETE) ? (
        <DangerZoneSection
          description="Permanently delete this library and all tenant data. Platform subscription invoices are retained for billing audit."
        >
          <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete library
          </Button>
          <DeleteLibraryDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            libraryName={library.name}
            loading={deleting}
            onConfirm={async (confirmPhrase) => {
              setDeleting(true);
              try {
                await libraryApi.deleteLibrary(library._id, confirmPhrase);
                toast.success('Library deleted');
                router.push(ROUTES.LIBRARIES);
              } catch (e) {
                toast.error(e instanceof ApiError ? e.message : 'Delete failed');
              } finally {
                setDeleting(false);
              }
            }}
          />
        </DangerZoneSection>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        <Link href={ROUTES.LIBRARIES} className="hover:text-foreground">
          Back to libraries
        </Link>
      </p>
    </div>
  );
}
