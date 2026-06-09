'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Pencil, Settings2 } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { Can } from '@/components/auth/can';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES, libraryBranchNewRoute, libraryBranchesRoute, libraryEditRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { ApiError } from '@/lib/api-error';
import { libraryApi } from '@/modules/library/library.service';
import { libraryQueryKeys } from '@/modules/library/library-query-keys';
import { SubscriptionPlanBadge } from '@/modules/subscription/components/subscription-plan-badge';

export default function LibraryDetailPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const { can } = usePermissions();

  const { data: library, isLoading, error } = useQuery({
    queryKey: libraryQueryKeys.library(libraryId),
    queryFn: () => libraryApi.getLibrary(libraryId),
    enabled: Boolean(libraryId) && can(PERMISSIONS.LIBRARY_READ),
  });

  const { data: branchesPreview } = useQuery({
    queryKey: libraryQueryKeys.branches(libraryId, { page: 1, limit: 1 }),
    queryFn: () => libraryApi.listBranches(libraryId, { page: 1, limit: 1 }),
    enabled: Boolean(libraryId) && can(PERMISSIONS.BRANCH_READ),
  });

  if (!can(PERMISSIONS.LIBRARY_READ)) {
    return <EmptyState title="No access" description="You cannot view this library." />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !library) {
    const msg = error instanceof ApiError ? error.message : 'Library not found';
    return <EmptyState title="Unable to load library" description={msg} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={library.name}
        description={`Slug ${library.slug} · ${library.email}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{library.status}</Badge>
            <SubscriptionPlanBadge
              libraryId={library._id}
              planCode={library.plan?.code ?? library.subscription?.planCode ?? library.subscriptionPlan}
              prefetchedSnapshot={library.plan ? { plan: library.plan } : undefined}
              prefetchedSubscription={library.subscription}
            />
            <Can permission={PERMISSIONS.LIBRARY_UPDATE}>
              <Button variant="outline" size="sm" asChild>
                <Link href={libraryEditRoute(library._id)}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden />
                  Edit
                </Link>
              </Button>
            </Can>
            <Can permission={PERMISSIONS.BRANCH_READ}>
              <Button size="sm" asChild>
                <Link href={libraryBranchesRoute(library._id)}>
                  <Building2 className="mr-2 h-4 w-4" aria-hidden />
                  Branches
                </Link>
              </Button>
            </Can>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 shadow-soft lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Location</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/80">Address</p>
              <p>{library.address || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/80">City / State</p>
              <p>
                {[library.city, library.state].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/80">Country</p>
              <p>{library.country || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/80">Pincode</p>
              <p>{library.pincode || '—'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-soft">
          <CardHeader>
            <CardTitle className="text-base">Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {can(PERMISSIONS.BRANCH_READ) ? (
              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                <span className="text-muted-foreground">Branches</span>
                <span className="font-semibold text-foreground">
                  {branchesPreview?.pagination.total ?? '—'}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <span className="text-muted-foreground">Timezone</span>
              <span className="font-medium">{library.timezone}</span>
            </div>
            <Can permission={PERMISSIONS.BRANCH_CREATE}>
              <Button className="w-full" variant="secondary" asChild>
                <Link href={libraryBranchNewRoute(library._id)}>New branch</Link>
              </Button>
            </Can>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4" aria-hidden />
            Settings snapshot
          </CardTitle>
          <Can permission={PERMISSIONS.LIBRARY_UPDATE}>
            <Button variant="ghost" size="sm" asChild>
              <Link href={libraryEditRoute(library._id)}>Manage in edit</Link>
            </Button>
          </Can>
        </CardHeader>
        <CardContent>
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-4 text-xs leading-relaxed">
            {JSON.stringify(library.settings ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <div className="flex justify-between text-sm text-muted-foreground">
        <Link href={ROUTES.LIBRARIES} className="hover:text-foreground">
          ← All libraries
        </Link>
      </div>
    </div>
  );
}
