'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { libraryBranchDetailRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { BranchForm } from '@/modules/library/components/branch-form';
import { libraryApi } from '@/modules/library/library.service';
import { libraryQueryKeys } from '@/modules/library/library-query-keys';

export default function EditBranchPage() {
  const params = useParams<{ libraryId: string; branchId: string }>();
  const { libraryId, branchId } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  const { data: branch, isLoading, error } = useQuery({
    queryKey: libraryQueryKeys.branch(libraryId, branchId),
    queryFn: () => libraryApi.getBranch(libraryId, branchId),
    enabled: Boolean(libraryId && branchId) && can(PERMISSIONS.BRANCH_READ),
  });

  if (!can(PERMISSIONS.BRANCH_UPDATE)) {
    return <EmptyState title="No access" description="You cannot edit branches." />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !branch) {
    const msg = error instanceof ApiError ? error.message : 'Branch not found';
    return <EmptyState title="Error" description={msg} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${branch.branchName}`}
        description="Update operational details for this branch."
        actions={
          <Button variant="outline" asChild>
            <Link href={libraryBranchDetailRoute(libraryId, branch._id)}>Cancel</Link>
          </Button>
        }
      />
      <BranchForm
        mode="edit"
        initial={branch}
        onSubmit={async (payload) => {
          try {
            await libraryApi.updateBranch(libraryId, branch._id, payload);
            toast.success('Branch saved');
            await queryClient.invalidateQueries({ queryKey: ['libraries', libraryId, 'branches'] });
            await queryClient.invalidateQueries({
              queryKey: libraryQueryKeys.branch(libraryId, branch._id),
            });
            router.push(libraryBranchDetailRoute(libraryId, branch._id));
          } catch (e) {
            if (e instanceof ApiError) toast.error(e.message);
            else toast.error('Save failed');
            throw e;
          }
        }}
      />
    </div>
  );
}
