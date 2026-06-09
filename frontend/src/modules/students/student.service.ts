import { apiClient, request, requestDataAndMeta } from '@/lib/axios';

import type { StudentPortalWallet } from '@/modules/payments/types';

import type { AdmissionResult } from './types-admission';
import type { PaginatedStudents, Student, StudentSummaryResponse } from './types';
import type { StudentMySeat } from './types-seat';

export interface StudentListParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: Student['status'];
  branchId?: string;
  libraryId?: string;
  membershipExpired?: boolean;
  membershipFilter?: 'active' | 'expired' | 'expiring1to3' | 'expiring4to7' | 'expiredToday';
  membershipStatus?: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  expiringIn?: '1-3' | '4-7';
  membershipExpiresBefore?: string;
  membershipExpiresAfter?: string;
}

export interface StudentFileUploads {
  profilePhoto?: File;
  documentProof?: File;
}

export type StudentPayload = Record<string, unknown>;

export const studentApi = {
  async list(params: StudentListParams): Promise<PaginatedStudents> {
    const { data, meta } = await requestDataAndMeta<{ items: Student[] }>({
      url: '/students',
      method: 'GET',
      params: {
        ...params,
        membershipExpired:
          params.membershipExpired === undefined ? undefined : String(params.membershipExpired),
      },
    });
    const pagination = meta?.pagination;
    if (!pagination) {
      return {
        items: data.items,
        pagination: {
          total: data.items.length,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
    return { items: data.items, pagination };
  },

  async get(id: string): Promise<Student> {
    const { student } = await request<{ student: Student }>({
      url: `/students/${id}`,
      method: 'GET',
    });
    return student;
  },

  async summary(id: string): Promise<StudentSummaryResponse> {
    return request<StudentSummaryResponse>({
      url: `/students/${id}/summary`,
      method: 'GET',
    });
  },

  async admitAdmission(body: StudentPayload, files?: StudentFileUploads): Promise<AdmissionResult> {
    const form = this.buildStudentFormData(body, files ?? {});
    return request<AdmissionResult>({
      url: '/students/admission',
      method: 'POST',
      data: form,
    });
  },

  async create(body: StudentPayload, files?: StudentFileUploads): Promise<Student> {
    if (files?.profilePhoto || files?.documentProof) {
      return this.createWithFiles(body, files);
    }
    const { student } = await request<{ student: Student }>({
      url: '/students',
      method: 'POST',
      data: body,
    });
    return student;
  },

  async createWithFiles(body: StudentPayload, files: StudentFileUploads): Promise<Student> {
    const form = this.buildStudentFormData(body, files);
    const { student } = await request<{ student: Student }>({
      url: '/students',
      method: 'POST',
      data: form,
    });
    return student;
  },

  async update(id: string, body: StudentPayload, files?: StudentFileUploads): Promise<Student> {
    if (files?.profilePhoto || files?.documentProof) {
      return this.updateWithFiles(id, body, files);
    }
    const { student } = await request<{ student: Student }>({
      url: `/students/${id}`,
      method: 'PATCH',
      data: body,
    });
    return student;
  },

  async updateWithFiles(id: string, body: StudentPayload, files: StudentFileUploads): Promise<Student> {
    const form = this.buildStudentFormData(body, files);
    const { student } = await request<{ student: Student }>({
      url: `/students/${id}`,
      method: 'PATCH',
      data: form,
    });
    return student;
  },

  buildStudentFormData(body: StudentPayload, files: StudentFileUploads): FormData {
    const form = new FormData();
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'object' && !(value instanceof Date)) {
        form.append(key, JSON.stringify(value));
        continue;
      }
      if (typeof value === 'boolean') {
        form.append(key, value ? 'true' : 'false');
      } else if (value instanceof Date) {
        form.append(key, value.toISOString());
      } else {
        form.append(key, String(value));
      }
    }
    if (files.profilePhoto) form.append('profilePhoto', files.profilePhoto);
    if (files.documentProof) form.append('documentProof', files.documentProof);
    return form;
  },

  async downloadIdCard(
    studentId: string,
    opts?: { disposition?: 'inline' | 'attachment' },
  ): Promise<Blob> {
    const res = await apiClient.get(`/students/${studentId}/id-card`, {
      responseType: 'blob',
      params: opts?.disposition ? { disposition: opts.disposition } : undefined,
    });
    return res.data as Blob;
  },

  async downloadMyIdCard(opts?: { disposition?: 'inline' | 'attachment' }): Promise<Blob> {
    const res = await apiClient.get('/students/me/id-card', {
      responseType: 'blob',
      params: opts?.disposition ? { disposition: opts.disposition } : undefined,
    });
    return res.data as Blob;
  },

  async remove(id: string): Promise<void> {
    await request<{ id: string }>({
      url: `/students/${id}`,
      method: 'DELETE',
    });
  },

  async transfer(id: string, branchId: string): Promise<Student> {
    const { student } = await request<{ student: Student }>({
      url: `/students/${id}/transfer`,
      method: 'POST',
      data: { branchId },
    });
    return student;
  },

  async assignSeat(
    id: string,
    assignedSeatId: string | null,
    shiftId?: string,
  ): Promise<Student> {
    const { student } = await request<{ student: Student }>({
      url: `/students/${id}/seat`,
      method: 'PATCH',
      data: { assignedSeatId, ...(shiftId ? { shiftId } : {}) },
    });
    return student;
  },

  async me(): Promise<Student> {
    const { student } = await request<{ student: Student }>({
      url: '/students/me',
      method: 'GET',
    });
    return student;
  },

  async myAttendance(params: {
    page?: number;
    limit?: number;
  }): Promise<{ items: unknown[]; pagination: PaginatedStudents['pagination'] }> {
    const { data, meta } = await requestDataAndMeta<{ items: unknown[] }>({
      url: '/students/me/attendance',
      method: 'GET',
      params,
    });
    return {
      items: data.items,
      pagination:
        meta?.pagination ??
        {
          total: data.items.length,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
    };
  },

  async mySeat(): Promise<StudentMySeat | null> {
    const { seat } = await request<{ seat: StudentMySeat | null }>({
      url: '/students/me/seat',
      method: 'GET',
    });
    return seat;
  },

  async myPayments(): Promise<StudentPortalWallet> {
    return request<StudentPortalWallet>({
      url: '/students/me/payments',
      method: 'GET',
    });
  },
};
