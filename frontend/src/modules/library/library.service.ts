import { request, requestDataAndMeta } from '@/lib/axios';

import type { Branch, Library, Paginated } from './types';

export type BranchDeleteImpact = {
  branchId: string;
  branchName: string;
  students: number;
  seats: number;
  staff: number;
};

export interface LibraryListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'name' | 'status' | 'slug';
  sortOrder?: 'asc' | 'desc';
  status?: 'ACTIVE' | 'TRIAL' | 'SUSPENDED';
  country?: string;
  subscriptionPlan?:
    | 'FREE'
    | 'STARTER'
    | 'BASIC'
    | 'GROWTH'
    | 'PROFESSIONAL'
    | 'ENTERPRISE';
  billingCycle?: 'TRIAL' | 'MONTHLY' | 'YEARLY' | 'CUSTOM';
  expiryState?: string;
  expiringWithinDays?: number;
}

export interface BranchListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'branchName' | 'branchCode' | 'totalSeats';
  sortOrder?: 'asc' | 'desc';
  active?: boolean;
  city?: string;
}

export type LibraryPayload = Record<string, unknown>;
export type BranchPayload = Record<string, unknown>;

export const libraryApi = {
  async listLibraries(params: LibraryListParams): Promise<Paginated<Library>> {
    const { data, meta } = await requestDataAndMeta<{ items: Library[] }>({
      url: '/libraries',
      method: 'GET',
      params,
    });
    const pagination = meta?.pagination;
    if (!pagination) {
      return {
        items: data.items,
        pagination: { total: data.items.length, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      };
    }
    return { items: data.items, pagination };
  },

  async getLibrary(libraryId: string): Promise<Library> {
    const { library } = await request<{ library: Library }>({
      url: `/libraries/${libraryId}`,
      method: 'GET',
    });
    return library;
  },

  async createLibrary(body: LibraryPayload | FormData): Promise<Library> {
    const { library } = await request<{ library: Library }>({
      url: '/libraries',
      method: 'POST',
      data: body,
    });
    return library;
  },

  async updateLibrary(libraryId: string, body: LibraryPayload | FormData): Promise<Library> {
    const { library } = await request<{ library: Library }>({
      url: `/libraries/${libraryId}`,
      method: 'PATCH',
      data: body,
    });
    return library;
  },

  async patchLibrarySettings(libraryId: string, settings: Record<string, unknown>): Promise<Library> {
    const { library } = await request<{ library: Library }>({
      url: `/libraries/${libraryId}/settings`,
      method: 'PATCH',
      data: { settings },
    });
    return library;
  },

  async deleteLibrary(libraryId: string, confirmPhrase: string): Promise<void> {
    await request<{ id: string }>({
      url: `/libraries/${libraryId}`,
      method: 'DELETE',
      data: { confirmPhrase },
    });
  },

  async getBranchDeleteImpact(libraryId: string, branchId: string): Promise<BranchDeleteImpact> {
    return request<BranchDeleteImpact>({
      url: `/libraries/${libraryId}/branches/${branchId}/delete-impact`,
      method: 'GET',
    });
  },

  async listBranches(libraryId: string, params: BranchListParams): Promise<Paginated<Branch>> {
    const { data, meta } = await requestDataAndMeta<{ items: Branch[] }>({
      url: `/libraries/${libraryId}/branches`,
      method: 'GET',
      params: {
        ...params,
        active: params.active === undefined ? undefined : String(params.active),
      },
    });
    const pagination = meta?.pagination;
    if (!pagination) {
      return {
        items: data.items,
        pagination: { total: data.items.length, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false },
      };
    }
    return { items: data.items, pagination };
  },

  async getBranch(libraryId: string, branchId: string): Promise<Branch> {
    const { branch } = await request<{ branch: Branch }>({
      url: `/libraries/${libraryId}/branches/${branchId}`,
      method: 'GET',
    });
    return branch;
  },

  async createBranch(libraryId: string, body: BranchPayload): Promise<Branch> {
    const { branch } = await request<{ branch: Branch }>({
      url: `/libraries/${libraryId}/branches`,
      method: 'POST',
      data: body,
    });
    return branch;
  },

  async updateBranch(libraryId: string, branchId: string, body: BranchPayload): Promise<Branch> {
    const { branch } = await request<{ branch: Branch }>({
      url: `/libraries/${libraryId}/branches/${branchId}`,
      method: 'PATCH',
      data: body,
    });
    return branch;
  },

  async deleteBranch(libraryId: string, branchId: string): Promise<void> {
    await request<{ id: string }>({
      url: `/libraries/${libraryId}/branches/${branchId}`,
      method: 'DELETE',
    });
  },
};
