import { request, requestDataAndMeta } from '@/lib/axios';

import type {
  BulkSeatResult,
  OccupancySummary,
  PaginatedSeats,
  Seat,
  SeatListParams,
  SeatOccupancyGrid,
} from './types';

function serializeListParams(params: SeatListParams): Record<string, string | number | undefined> {
  return {
    ...params,
    occupied: params.occupied === undefined ? undefined : (params.occupied ? 'true' : 'false'),
    active: params.active === undefined ? undefined : (params.active ? 'true' : 'false'),
  };
}

export const seatApi = {
  async list(params: SeatListParams): Promise<PaginatedSeats> {
    const { data, meta } = await requestDataAndMeta<{ items: Seat[] }>({
      url: '/seats',
      method: 'GET',
      params: serializeListParams(params),
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

  async listAvailable(params: SeatListParams): Promise<PaginatedSeats> {
    const { data, meta } = await requestDataAndMeta<{ items: Seat[] }>({
      url: '/seats/available',
      method: 'GET',
      params: serializeListParams(params),
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

  async listReserved(params: SeatListParams): Promise<PaginatedSeats> {
    const { data, meta } = await requestDataAndMeta<{ items: Seat[] }>({
      url: '/seats/reserved',
      method: 'GET',
      params: serializeListParams(params),
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

  async occupancySummary(q: { libraryId?: string; branchId?: string }): Promise<OccupancySummary> {
    return request<OccupancySummary>({
      url: '/seats/occupancy/summary',
      method: 'GET',
      params: q,
    });
  },

  async get(id: string): Promise<Seat> {
    const { seat } = await request<{ seat: Seat }>({
      url: `/seats/${id}`,
      method: 'GET',
    });
    return seat;
  },

  async create(body: Record<string, unknown>): Promise<Seat> {
    const { seat } = await request<{ seat: Seat }>({
      url: '/seats',
      method: 'POST',
      data: body,
    });
    return seat;
  },

  async bulkCreate(body: Record<string, unknown>): Promise<BulkSeatResult> {
    return request<BulkSeatResult>({
      url: '/seats/bulk',
      method: 'POST',
      data: body,
    });
  },

  async update(id: string, body: Record<string, unknown>): Promise<Seat> {
    const { seat } = await request<{ seat: Seat }>({
      url: `/seats/${id}`,
      method: 'PATCH',
      data: body,
    });
    return seat;
  },

  async remove(id: string): Promise<void> {
    await request({
      url: `/seats/${id}`,
      method: 'DELETE',
    });
  },

  async assign(seatId: string, studentId: string, shiftId: string): Promise<Seat> {
    const { seat } = await request<{ seat: Seat }>({
      url: `/seats/${seatId}/assign`,
      method: 'POST',
      data: { studentId, shiftId },
    });
    return seat;
  },

  async unassign(seatId: string): Promise<Seat> {
    const { seat } = await request<{ seat: Seat }>({
      url: `/seats/${seatId}/unassign`,
      method: 'POST',
    });
    return seat;
  },

  async grid(params: { branchId: string; floor?: string; zone?: string }): Promise<SeatOccupancyGrid> {
    return request<SeatOccupancyGrid>({
      url: '/seats/grid',
      method: 'GET',
      params,
    });
  },

  async seatOccupancy(seatId: string) {
    return request<{
      seat: Seat;
      assignments: unknown[];
      shifts: unknown[];
    }>({
      url: `/seats/${seatId}/occupancy`,
      method: 'GET',
    });
  },
};

export const seatAssignmentApi = {
  create(body: {
    seatId: string;
    studentId: string;
    shiftId: string;
    status?: 'ACTIVE' | 'RESERVED';
  }) {
    return request<{ assignment: unknown }>({
      url: '/seat-assignments',
      method: 'POST',
      data: body,
    });
  },

  update(
    assignmentId: string,
    body: { studentId?: string; shiftId?: string; status?: string },
  ) {
    return request<{ assignment: unknown }>({
      url: `/seat-assignments/${assignmentId}`,
      method: 'PATCH',
      data: body,
    });
  },

  remove(assignmentId: string) {
    return request<{ assignment: unknown }>({
      url: `/seat-assignments/${assignmentId}`,
      method: 'DELETE',
    });
  },
};
