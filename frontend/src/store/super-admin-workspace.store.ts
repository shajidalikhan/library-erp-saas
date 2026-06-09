import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WorkspaceSlice = {
  libraryId: string;
  branchId: string;
  setWorkspace: (next: { libraryId?: string; branchId?: string }) => void;
  clear: () => void;
};

/**
 * Persisted tenant workspace for SUPER_ADMIN only (library + optional branch).
 * Lets admins switch libraries once and keep context across dashboard pages.
 */
export const useSuperAdminWorkspaceStore = create<WorkspaceSlice>()(
  persist(
    (set) => ({
      libraryId: '',
      branchId: '',
      setWorkspace: (next) =>
        set((s) => ({
          libraryId: next.libraryId !== undefined ? next.libraryId : s.libraryId,
          branchId: next.branchId !== undefined ? next.branchId : s.branchId,
        })),
      clear: () => set({ libraryId: '', branchId: '' }),
    }),
    { name: 'library-erp-super-admin-workspace' },
  ),
);
