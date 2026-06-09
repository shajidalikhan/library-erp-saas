import { request, requestDataAndMeta } from '@/lib/axios';

import type {
  AttendanceListParams,
  AttendancePagination,
  AttendanceRecord,
  AttendanceSummary,
} from './types';
import type { AttendanceBoardParams, AttendanceBoardResponse } from './types-board';

function withBooleanParams(params: AttendanceListParams): Record<string, unknown> {
  return {
    ...params,
    activeOnly:
      params.activeOnly === undefined ? undefined : params.activeOnly ? 'true' : 'false',
  };
}

function normalizedPagination(itemsCount: number): AttendancePagination {
  return {
    total: itemsCount,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };
}

export const attendanceApi = {
  async board(params: AttendanceBoardParams): Promise<AttendanceBoardResponse> {
    return request<AttendanceBoardResponse>({
      url: '/attendance/board',
      method: 'GET',
      params,
    });
  },

  async checkIn(body: {
    studentId: string;
    libraryId?: string;
    branchId?: string;
    seatId?: string;
    method?: 'MANUAL' | 'QR' | 'RFID' | 'BIOMETRIC';
    notes?: string;
  }): Promise<AttendanceRecord> {
    const { attendance } = await request<{ attendance: AttendanceRecord }>({
      url: '/attendance/check-in',
      method: 'POST',
      data: body,
    });
    return attendance;
  },

  async checkOut(body: {
    studentId: string;
    libraryId?: string;
    branchId?: string;
    notes?: string;
  }): Promise<AttendanceRecord> {
    const { attendance } = await request<{ attendance: AttendanceRecord }>({
      url: '/attendance/check-out',
      method: 'POST',
      data: body,
    });
    return attendance;
  },

  async manualEntry(body: Record<string, unknown>): Promise<AttendanceRecord> {
    const { attendance } = await request<{ attendance: AttendanceRecord }>({
      url: '/attendance/manual',
      method: 'POST',
      data: body,
    });
    return attendance;
  },

  async daily(params: AttendanceListParams): Promise<{ items: AttendanceRecord[]; pagination: AttendancePagination }> {
    const { data, meta } = await requestDataAndMeta<{ items: AttendanceRecord[] }>({
      url: '/attendance/daily',
      method: 'GET',
      params: withBooleanParams(params),
    });
    return { items: data.items, pagination: meta?.pagination ?? normalizedPagination(data.items.length) };
  },

  async active(params: AttendanceListParams): Promise<{ items: AttendanceRecord[]; pagination: AttendancePagination }> {
    const { data, meta } = await requestDataAndMeta<{ items: AttendanceRecord[] }>({
      url: '/attendance/active',
      method: 'GET',
      params: withBooleanParams(params),
    });
    return { items: data.items, pagination: meta?.pagination ?? normalizedPagination(data.items.length) };
  },

  async studentHistory(
    studentId: string,
    params: AttendanceListParams,
  ): Promise<{ items: AttendanceRecord[]; pagination: AttendancePagination }> {
    const { data, meta } = await requestDataAndMeta<{ items: AttendanceRecord[] }>({
      url: `/attendance/students/${studentId}/history`,
      method: 'GET',
      params: withBooleanParams(params),
    });
    return { items: data.items, pagination: meta?.pagination ?? normalizedPagination(data.items.length) };
  },

  async summary(params: {
    libraryId?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<AttendanceSummary> {
    return request<AttendanceSummary>({
      url: '/attendance/summary',
      method: 'GET',
      params,
    });
  },

  async update(attendanceId: string, body: Record<string, unknown>): Promise<AttendanceRecord> {
    const { attendance } = await request<{ attendance: AttendanceRecord }>({
      url: `/attendance/${attendanceId}`,
      method: 'PATCH',
      data: body,
    });
    return attendance;
  },
};
