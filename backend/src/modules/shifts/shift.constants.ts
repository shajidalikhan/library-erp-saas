export const SHIFT_KINDS = [
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'NIGHT',
  'FULL_DAY',
  'CUSTOM',
] as const;

export type ShiftKind = (typeof SHIFT_KINDS)[number];

export const SHIFT_ASSIGNMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  RESERVED: 'RESERVED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;

export type ShiftAssignmentStatus =
  (typeof SHIFT_ASSIGNMENT_STATUS)[keyof typeof SHIFT_ASSIGNMENT_STATUS];

/** Grid cell display states */
export const OCCUPANCY_CELL_STATE = {
  AVAILABLE: 'AVAILABLE',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  PUBLIC_HOLD: 'PUBLIC_HOLD',
  BLOCKED: 'BLOCKED',
  EXPIRED: 'EXPIRED',
} as const;

export type OccupancyCellState =
  (typeof OCCUPANCY_CELL_STATE)[keyof typeof OCCUPANCY_CELL_STATE];
