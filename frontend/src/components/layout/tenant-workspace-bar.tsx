'use client';

import { Building2, Library } from 'lucide-react';

import { BranchSelect } from '@/components/selectors/branch-select';
import { LibrarySelect } from '@/components/selectors/library-select';
import { useTenantScope } from '@/hooks/use-tenant-scope';

/**
 * Persistent SUPER_ADMIN library / branch context for operational dashboard pages.
 */
export function TenantWorkspaceBar({ showBranch = true }: { showBranch?: boolean }) {
  const {
    isSuperAdmin,
    effectiveLibraryId,
    effectiveBranchId,
    setSuperAdminWorkspace,
  } = useTenantScope();

  if (!isSuperAdmin) return null;

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-end">
      <div className="flex items-center gap-2 text-sm font-medium text-primary shrink-0">
        <Library className="h-4 w-4" aria-hidden />
        Workspace
      </div>
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        <LibrarySelect
          label="Library"
          value={effectiveLibraryId}
          onChange={(id) => setSuperAdminWorkspace({ libraryId: id, branchId: '' })}
        />
        {showBranch ? (
          <BranchSelect
            label="Branch (optional)"
            libraryId={effectiveLibraryId || null}
            value={effectiveBranchId}
            onChange={(id) => setSuperAdminWorkspace({ branchId: id })}
            disabled={!effectiveLibraryId}
          />
        ) : null}
      </div>
      {effectiveLibraryId && showBranch && !effectiveBranchId ? (
        <p className="text-xs text-muted-foreground sm:col-span-3 flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          Branch optional — pick one to narrow lists and attendance.
        </p>
      ) : null}
    </div>
  );
}
