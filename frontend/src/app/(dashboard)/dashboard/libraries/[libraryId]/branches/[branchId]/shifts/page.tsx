'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { ShiftManagementPanel } from '@/modules/shifts/components/shift-management-panel';

/** Legacy deep link — prefer {@link ROUTES.SHIFTS} from the sidebar. */
export default function BranchShiftsPage() {
  const params = useParams<{ libraryId: string; branchId: string }>();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shift management"
        description="Define custom shifts for this branch."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.SHIFTS}>All shifts</Link>
          </Button>
        }
      />
      <ShiftManagementPanel libraryId={params.libraryId} branchId={params.branchId} />
    </div>
  );
}
