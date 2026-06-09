'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { TenantBrand } from '@/components/layout/tenant-brand';
import { ROUTES } from '@/constants/routes';

import { SidebarNav } from './sidebar-nav';
import { UserMiniCard } from './user-mini-card';

/**
 * Mobile hamburger sidebar - rendered inside `TopNavbar` on `<lg` viewports.
 */
export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <div className="flex h-16 items-center border-b px-5">
          <TenantBrand href={ROUTES.DASHBOARD} />
        </div>
        <div className="flex-1 overflow-y-auto py-4 scrollbar-thin">
          <SidebarNav onItemClick={() => setOpen(false)} />
        </div>
        <div className="border-t p-3">
          <UserMiniCard />
        </div>
      </SheetContent>
    </Sheet>
  );
}
