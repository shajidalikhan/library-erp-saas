import { Suspense } from 'react';

import TenantSuspendedInner from './tenant-suspended-inner';

export default function TenantSuspendedPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading…</div>}>
      <TenantSuspendedInner />
    </Suspense>
  );
}
