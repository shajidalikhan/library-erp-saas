import type { PaginationMeta } from '@/types/api';

export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type StudentGender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export interface StudentMediaAsset {
  url: string;
  publicId: string;
  fileType?: string;
}

/** Full student record (also used for partial API projections). */
export interface Student {
  _id: string;
  libraryId: string;
  branchId: string;
  studentId: string;
  fullName: string;
  email?: string;
  phone?: string;
  gender?: StudentGender;
  dateOfBirth?: string | null;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  guardianName?: string;
  guardianPhone?: string;
  aadhaarNumber?: string;
  profilePhoto?: string | StudentMediaAsset;
  documentProof?: StudentMediaAsset;
  admissionDate?: string;
  membershipStartDate?: string;
  membershipEndDate?: string | null;
  status: StudentStatus;
  notes?: string;
  assignedSeatId?: string | null;
  currentShiftId?: string | null;
  seatShiftAssignments?: Array<{
    _id: string;
    shiftId: string | { _id: string; name?: string; startTime?: string; endTime?: string };
    seatId: string | { _id: string; seatNumber?: string; floor?: string; zone?: string };
    status: string;
  }>;
  seatNumber?: string | null;
  seatFloor?: string | null;
  seatZone?: string | null;
  seatType?: string | null;
  shiftType?: string | null;
  seatStatus?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  userId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentSummaryResponse {
  student: Student;
  attendance: { sessionsLast30d: number; lastCheckInAt: string | null };
  payments: { outstandingAmount: number; currency: string; lastPaymentAt: string | null };
  membership: {
    status: string;
    startDate: string;
    endDate: string | null;
    isExpired: boolean;
  };
}

export interface PaginatedStudents {
  items: Student[];
  pagination: PaginationMeta;
}
