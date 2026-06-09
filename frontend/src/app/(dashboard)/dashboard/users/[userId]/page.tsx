'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { formatEntityLabel } from '@/lib/entity-label';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PERMISSIONS } from '@/constants/permissions';
import { ROUTES, userEditRoute } from '@/constants/routes';
import { usePermissions } from '@/hooks/use-permissions';
import { Can } from '@/components/auth/can';
import { usersApi } from '@/modules/users/users.service';

export default function UserDetailPage() {
  const params = useParams();
  const userId = String(params.userId ?? '');
  const { canAny } = usePermissions();
  const canView = canAny([PERMISSIONS.USER_READ, PERMISSIONS.STAFF_READ]);

  const { data, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.get(userId),
    enabled: Boolean(userId) && canView,
  });

  if (!canView) {
    return <p className="text-sm text-muted-foreground">No access.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isLoading ? 'User' : data?.fullName ?? 'User'}
        description="Directory profile"
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={ROUTES.USERS}>Back to users</Link>
            </Button>
            <Can permission={[PERMISSIONS.USER_UPDATE, PERMISSIONS.STAFF_UPDATE]}>
              <Button asChild>
                <Link href={userEditRoute(userId)}>Edit</Link>
              </Button>
            </Can>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {isLoading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : data ? (
            <>
              <p>
                <span className="text-muted-foreground">Email:</span> {data.email}
              </p>
              {data.phone ? (
                <p>
                  <span className="text-muted-foreground">Phone:</span> {data.phone}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Role:</span> {String(data.role)}
              </p>
              <p>
                <span className="text-muted-foreground">Status:</span>{' '}
                <Badge variant={data.isActive ? 'default' : 'secondary'}>{data.isActive ? 'Active' : 'Inactive'}</Badge>
              </p>
              {data.libraryId ? (
                <p>
                  <span className="text-muted-foreground">Library:</span> {formatEntityLabel(data, 'library')}
                </p>
              ) : null}
              {data.branchId ? (
                <p>
                  <span className="text-muted-foreground">Branch:</span> {formatEntityLabel(data, 'branch')}
                </p>
              ) : null}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
