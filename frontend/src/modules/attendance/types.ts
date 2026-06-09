export type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'ABSENT'
  | 'EARLY_EXIT'
  | 'CHECKED_IN'
  | 'CHECKED_OUT';

export type AttendanceMethod = 'MANUAL' | 'QR' | 'RFID' | 'BIOMETRIC';

export interface AttendanceRecord {
  _id: string;
  libraryId: string;
  branchId: string;
  studentId:
    | string
    | {
        _id: string;
        fullName?: string;
        studentId?: string;
        phone?: string;
      };
  seatId:
    | string
    | null
    | {
        _id: string;
        seatNumber?: string;
        floor?: string;
        zone?: string;
      };
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  durationMinutes: number;
  status: AttendanceStatus;
  method: AttendanceMethod;
  checkOutSource?: 'MANUAL' | 'QR' | 'SYSTEM_AUTO' | null;
  notes?: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSummary {
  total: number;
  activeCheckIns: number;
  checkedOut: number;
  lateEntries: number;
  earlyExits: number;
  byBranch: Array<{ branchId: string; count: number }>;
}

export interface AttendanceListParams {
  page?: number;
  limit?: number;
  search?: string;
  libraryId?: string;
  branchId?: string;
  studentId?: string;
  seatId?: string;
  status?: AttendanceStatus;
  method?: AttendanceMethod;
  dateFrom?: string;
  dateTo?: string;
  activeOnly?: boolean;
  sortBy?: 'date' | 'checkInAt' | 'checkOutAt' | 'durationMinutes' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AttendancePagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}
