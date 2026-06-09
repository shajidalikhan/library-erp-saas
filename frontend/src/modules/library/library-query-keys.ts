import type { BranchListParams, LibraryListParams } from './library.service';

export const libraryQueryKeys = {
  libraries: (params: LibraryListParams) => ['libraries', params] as const,
  library: (id: string) => ['library', id] as const,
  branches: (libraryId: string, params: BranchListParams) =>
    ['libraries', libraryId, 'branches', params] as const,
  branch: (libraryId: string, branchId: string) =>
    ['libraries', libraryId, 'branches', 'detail', branchId] as const,
};
