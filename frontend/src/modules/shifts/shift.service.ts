import { request } from '@/lib/axios';

export type ShiftKind =
  | 'MORNING'
  | 'AFTERNOON'
  | 'EVENING'
  | 'NIGHT'
  | 'FULL_DAY'
  | 'CUSTOM';

export type Shift = {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  type: ShiftKind;
  color?: string;
  description?: string;
  active: boolean;
  branchId: string;
  libraryId: string;
};

export const shiftApi = {
  list: (params?: { branchId?: string; libraryId?: string; active?: string }) =>
    request<{ items: Shift[] }>({ url: '/shifts', method: 'GET', params }).then((r) => r.items),

  create: (body: Record<string, unknown>) =>
    request<{ shift: Shift }>({ url: '/shifts', method: 'POST', data: body }).then((r) => r.shift),

  update: (shiftId: string, body: Record<string, unknown>) =>
    request<{ shift: Shift }>({ url: `/shifts/${shiftId}`, method: 'PATCH', data: body }).then(
      (r) => r.shift,
    ),

  deactivate: (shiftId: string) =>
    request<{ shift: Shift }>({ url: `/shifts/${shiftId}`, method: 'DELETE' }).then((r) => r.shift),
};
