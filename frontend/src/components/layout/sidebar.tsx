'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { TenantBrand } from '@/components/layout/tenant-brand';
import { ROUTES } from '@/constants/routes';

import { SidebarNav } from './sidebar-nav';
import { UserMiniCard } from './user-mini-card';

/**
 * Desktop sidebar - permanently visible on `lg+`. Mobile uses the sheet
 * variant rendered by `top-navbar.tsx`.
 */
export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      <div className="flex h-16 items-center border-b px-5">
        <TenantBrand href={ROUTES.DASHBOARD} />
      </div>
      <ScrollArea className="flex-1 py-4">
        <SidebarNav />
      </ScrollArea>
      <div className="border-t p-3">
        <UserMiniCard />
      </div>
    </aside>
  );
}
