export const ATTENDANCE_STATUS = [
  'PRESENT',
  'LATE',
  'ABSENT',
  'EARLY_EXIT',
  'CHECKED_IN',
  'CHECKED_OUT',
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[number];

export const ATTENDANCE_METHOD = ['MANUAL', 'QR', 'RFID', 'BIOMETRIC'] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHOD)[number];

/** How a check-out was recorded. */
export const CHECKOUT_SOURCE = ['MANUAL', 'QR', 'SYSTEM_AUTO'] as const;
export type CheckOutSource = (typeof CHECKOUT_SOURCE)[number];

export const ATTENDANCE_SORT_FIELDS = [
  'date',
  'checkInAt',
  'checkOutAt',
  'durationMinutes',
  'createdAt',
] as const;
