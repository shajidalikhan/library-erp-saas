export const PUBLIC_PAYMENT_MODE = {
  OFFLINE: 'OFFLINE',
} as const;

export type PublicPaymentMode = (typeof PUBLIC_PAYMENT_MODE)[keyof typeof PUBLIC_PAYMENT_MODE];

export const PUBLIC_PAYMENT_STATUS = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING_OFFLINE: 'PENDING_OFFLINE',
} as const;

export type PublicPaymentStatus =
  (typeof PUBLIC_PAYMENT_STATUS)[keyof typeof PUBLIC_PAYMENT_STATUS];

export const PUBLIC_BOOKING_STATUS = {
  HOLD: 'HOLD',
  EXPIRED: 'EXPIRED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CONVERTED: 'CONVERTED',
  RELEASED_BY_STAFF: 'RELEASED_BY_STAFF',
} as const;

/** Active hold statuses that block the seat+shift for public visitors and internal grid. */
export const ACTIVE_PUBLIC_HOLD_STATUSES = [
  PUBLIC_BOOKING_STATUS.HOLD,
  PUBLIC_BOOKING_STATUS.APPROVED,
] as const;

export type PublicBookingStatus =
  (typeof PUBLIC_BOOKING_STATUS)[keyof typeof PUBLIC_BOOKING_STATUS];

export const PUBLIC_SEAT_CELL_STATUS = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  BLOCKED: 'BLOCKED',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
} as const;

export type PublicSeatCellStatus =
  (typeof PUBLIC_SEAT_CELL_STATUS)[keyof typeof PUBLIC_SEAT_CELL_STATUS];
