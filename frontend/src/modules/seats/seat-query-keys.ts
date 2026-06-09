export const seatQueryKeys = {
  all: ['seats'] as const,
  list: (params: unknown) => [...seatQueryKeys.all, 'list', params] as const,
  detail: (id: string) => [...seatQueryKeys.all, 'detail', id] as const,
  occupancy: (params: unknown) => [...seatQueryKeys.all, 'occupancy', params] as const,
  reserved: (params: unknown) => [...seatQueryKeys.all, 'reserved', params] as const,
  available: (params: unknown) => [...seatQueryKeys.all, 'available', params] as const,
};
