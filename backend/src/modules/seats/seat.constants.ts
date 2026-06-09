export const SEAT_TYPES = ['STANDARD', 'PREMIUM', 'CABIN', 'SILENT_ZONE'] as const;
export type SeatType = (typeof SEAT_TYPES)[number];

export const SHIFT_TYPES = ['FULL_DAY', 'MORNING', 'EVENING', 'NIGHT'] as const;
export type ShiftType = (typeof SHIFT_TYPES)[number];

export const SEAT_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'BLOCKED'] as const;
export type SeatStatus = (typeof SEAT_STATUSES)[number];
