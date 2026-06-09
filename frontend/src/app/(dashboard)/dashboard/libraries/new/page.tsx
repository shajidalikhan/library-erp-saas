'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Can } from '@/components/auth/can';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES, libraryDetailRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import type { LibrarySubmitOptions } from '@/modules/library/components/library-form';
import { LibraryForm } from '@/modules/library/components/library-form';
import { libraryApi } from '@/modules/library/library.service';

export default function NewLibraryPage() {
  const { can } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  if (!can(PERMISSIONS.LIBRARY_CREATE)) {
    return (
      <EmptyState
        title="Restricted"
        description="Only platform administrators can create libraries."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create library"
        description="Provision a new tenant and optionally bind an owner account."
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.LIBRARIES}>Back to list</Link>
          </Button>
        }
      />
      <LibraryForm
        mode="create"
        showOwnerField
        showSlugField
        showSubscriptionAssign
        showPlanAndStatus={false}
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

            const created = await libraryApi.createLibrary(body);
            toast.success('Library created');
            await queryClient.invalidateQueries({ queryKey: ['libraries'] });
            router.push(libraryDetailRoute(created._id));
          } catch (e) {
            if (e instanceof ApiError) toast.error(e.message);
            else toast.error('Could not create library');
            throw e;
          }
        }}
      />
    </div>
  );
}
