import { request, requestDataAndMeta } from '@/lib/axios';

import type { RoleName } from '@/constants/permissions';

export interface ManagedUser {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: RoleName | string;
  libraryId?: string | null;
  branchId?: string | null;
  isActive: boolean;
  status?: string;
  isRootSuperAdmin?: boolean;
  isEmailVerified: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  libraryId?: string;
  branchId?: string;
  role?: string;
  isActive?: boolean;
  includeInactive?: boolean;
  status?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  isActive?: boolean;
  role: string;
  libraryId?: string;
  branchId?: string;
}

export interface UpdateUserPayload {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  isActive?: boolean;
  role?: string;
  libraryId?: string;
  branchId?: string;
}

export const usersApi = {
  async list(params: UserListParams): Promise<{ items: ManagedUser[]; pagination: unknown }> {
    const { data, meta } = await requestDataAndMeta<{ items: ManagedUser[] }>({
      url: '/users',
      method: 'GET',
      params: {
        ...params,
        includeInactive:
          params.includeInactive === undefined ? undefined : String(params.includeInactive),
        isActive: params.isActive === undefined ? undefined : String(params.isActive),
      },
    });
    const pagination = meta?.pagination ?? {
      total: data.items.length,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    };
    return { items: data.items, pagination };
  },

  async get(id: string): Promise<ManagedUser> {
    const { user } = await request<{ user: ManagedUser }>({
      url: `/users/${id}`,
      method: 'GET',
    });
    return user;
  },

  async create(body: CreateUserPayload): Promise<ManagedUser> {
    const { user } = await request<{ user: ManagedUser }>({
      url: '/users',
      method: 'POST',
      data: body,
    });
    return user;
  },

  async update(id: string, body: UpdateUserPayload): Promise<ManagedUser> {
    const { user } = await request<{ user: ManagedUser }>({
      url: `/users/${id}`,
      method: 'PATCH',
      data: body,
    });
    return user;
  },

  async activate(id: string): Promise<{ id: string; status: string; isActive: boolean }> {
    return request({
      url: `/users/${id}/activate`,
      method: 'PATCH',
    });
  },

  async deactivate(id: string): Promise<{ id: string; status: string; isActive: boolean }> {
    return request({
      url: `/users/${id}/deactivate`,
      method: 'PATCH',
    });
  },

  async remove(id: string): Promise<void> {
    await request({
      url: `/users/${id}`,
      method: 'DELETE',
      data: { confirm: 'DELETE' },
    });
  },
};
