/** UI-facing student attendance state on the board. */
export const BOARD_ATTENDANCE_STATUS = [
  'CHECKED_IN',
  'CHECKED_OUT',
  'CHECKED_OUT_AUTO',
  'NOT_CHECKED_IN',
  'LATE',
] as const;

export type BoardAttendanceStatus = (typeof BOARD_ATTENDANCE_STATUS)[number];

/** Seat grid cell state for attendance board. */
export const BOARD_GRID_STATE = [
  'VACANT',
  'ASSIGNED_NOT_CHECKED_IN',
  'CHECKED_IN',
  'CHECKED_OUT',
  'LATE',
  'ABSENT',
  'BLOCKED',
] as const;

export type BoardGridState = (typeof BOARD_GRID_STATE)[number];
