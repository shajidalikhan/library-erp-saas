'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore, selectUser } from '@/store/auth.store';
import { getInitials } from '@/lib/utils';

/**
 * Compact identity chip shown at the bottom of the sidebar.
 * Click handlers belong to the surrounding profile dropdown - this is
 * purely a presentational anchor so a logged-in user always sees who
 * they are in the workspace.
 */
export function UserMiniCard() {
  const user = useAuthStore(selectUser);

  if (!user) {
    return (
      <div className="flex items-center gap-3 rounded-md px-2 py-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{user.role.replace('_', ' ')}</p>
      </div>
    </div>
  );
}
