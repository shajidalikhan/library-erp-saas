export type SeatType = 'STANDARD' | 'PREMIUM' | 'CABIN' | 'SILENT_ZONE';
/** @deprecated Seats are shift-neutral; use SeatAssignment + Shift. */
export type ShiftType = 'FULL_DAY' | 'MORNING' | 'EVENING' | 'NIGHT';
export type SeatStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE' | 'BLOCKED';

export type OccupancyCellState =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'PUBLIC_HOLD'
  | 'BLOCKED'
  | 'EXPIRED';

export interface PublicHoldSummary {
  bookingId: string;
  bookingReference: string;
  fullName: string;
  phone: string;
  expiresAt: string | null;
  status: string;
  shiftName?: string;
  seatNumber?: string;
}

export interface SeatGridStudent {
  fullName: string;
  studentCode: string;
  phone?: string | null;
  profilePhotoUrl?: string | null;
  membershipEndDate?: string | null;
}

export interface SeatGridCell {
  state: OccupancyCellState;
  assignmentId?: string;
  student?: SeatGridStudent | null;
  conflictReason?: string | null;
  availabilityHint?: string | null;
  publicHold?: PublicHoldSummary | null;
}

export interface SeatGridShift {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  type: string;
  color?: string;
}

export interface SeatGridSeat {
  _id: string;
  seatNumber: string;
  floor: string;
  zone: string;
  seatType: SeatType;
  status: SeatStatus;
  active: boolean;
  occupied: boolean;
}

export interface SeatOccupancyGrid {
  branch: { _id: string; branchName: string; branchCode?: string };
  shifts: SeatGridShift[];
  seats: SeatGridSeat[];
  cells: Record<string, Record<string, SeatGridCell>>;
  summary: {
    totalSeats: number;
    totalShifts: number;
    occupiedCells: number;
    availableCells: number;
    blockedCells: number;
    vacantSeats: number;
    partialSeats: number;
    fullyUtilizedSeats: number;
    occupiedByShift: Array<{ shiftId: string; shiftName: string; occupied: number }>;
  };
}

export interface SeatShiftAssignment {
  _id: string;
  shiftId?: { _id: string; name: string; startTime?: string; endTime?: string };
  studentId?: { _id: string; fullName: string; studentId?: string };
}

export interface Seat {
  _id: string;
  libraryId: string;
  branchId: string;
  seatNumber: string;
  floor: string;
  zone: string;
  seatType: SeatType;
  shiftType?: ShiftType;
  shiftAssignments?: SeatShiftAssignment[];
  assignedStudentId?: string | null;
  occupied: boolean;
  active: boolean;
  status: SeatStatus;
  notes?: string;
  reservedUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeatListParams {
  page?: number;
  limit?: number;
  search?: string;
  libraryId?: string;
  branchId?: string;
  floor?: string;
  zone?: string;
  shiftType?: ShiftType;
  seatType?: SeatType;
  status?: SeatStatus;
  occupied?: boolean;
  active?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SeatPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedSeats {
  items: Seat[];
  pagination: SeatPagination;
}

export interface OccupancySummary {
  total: number;
  occupied: number;
  availableAssignable: number;
  byStatus: Record<string, number>;
  partialSeats?: number;
  fullyUtilizedSeats?: number;
  occupiedByShift?: { shiftId: string; shiftName: string; occupied: number }[];
}

export interface BulkSeatResult {
  createdCount: number;
  items: Seat[];
}
