'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { PERMISSIONS } from '@/constants/permissions';
import { libraryBranchDetailRoute, libraryBranchesRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { BranchForm } from '@/modules/library/components/branch-form';
import { libraryApi } from '@/modules/library/library.service';

export default function NewBranchPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  if (!can(PERMISSIONS.BRANCH_CREATE)) {
    return <EmptyState title="No access" description="You cannot create branches." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New branch"
        description="Add a location under this library tenant."
        actions={
          <Button variant="outline" asChild>
            <Link href={libraryBranchesRoute(libraryId)}>Back to branches</Link>
          </Button>
        }
      />
      <BranchForm
        mode="create"
        onSubmit={async (payload) => {
          try {
            const branch = await libraryApi.createBranch(libraryId, payload);
            toast.success('Branch created');
            await queryClient.invalidateQueries({ queryKey: ['libraries', libraryId, 'branches'] });
            router.push(libraryBranchDetailRoute(libraryId, branch._id));
          } catch (e) {
            if (e instanceof ApiError) toast.error(e.message);
            else toast.error('Could not create branch');
            throw e;
          }
        }}
      />
    </div>
  );
}
