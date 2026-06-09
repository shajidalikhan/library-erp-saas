export interface PublicLibraryProfile {
  library: {
    id: string;
    name: string;
    slug: string;
    description: string;
    logo?: unknown;
    coverPhotos: Array<{
      url: string;
      publicId: string;
      caption?: string;
      isCover: boolean;
      order: number;
    }>;
    address: string;
    city: string;
    phone?: string;
    email?: string;
    whatsapp?: string;
    mapLocation?: string;
    latitude?: number | null;
    longitude?: number | null;
    amenities: string[];
    rules: string[];
  };
  branches: Array<{
    _id: string;
    branchName: string;
    city: string;
    address: string;
    phone?: string;
  }>;
  shifts: Array<{
    _id: string;
    branchId: string;
    name: string;
    startTime: string;
    endTime: string;
    type: string;
    color: string;
  }>;
  feePlans: Array<{
    _id: string;
    branchId: string;
    name: string;
    type: string;
    amount: number;
    durationDays: number;
    shiftId: string | null;
  }>;
  booking: {
    enabled: boolean;
    holdHours?: number;
    onlinePaymentEnabled?: boolean;
    offlinePaymentAllowed?: boolean;
  };
  publicBookingSettings?: {
    showFullSeatBreakdown: boolean;
  };
  shiftStats?: Array<{
    shiftId: string;
    branchId: string;
    availableSeats: number;
    startingPrice: number | null;
    startingDurationDays?: number | null;
    planCount: number;
  }>;
  seatAvailabilitySummary: Record<string, number>;
  publicStudentFields?: Array<{
    fieldKey: string;
    label: string;
    type: string;
    required: boolean;
    options?: string[];
    order: number;
  }>;
}

export interface PublicAvailabilityResponse {
  branchId: string;
  shiftId: string;
  seats: Array<{
    _id: string;
    seatNumber: string;
    floor: string;
    zone: string;
    status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' | 'NOT_AVAILABLE';
  }>;
}

export interface PublicBookingPayload {
  branchId: string;
  shiftId: string;
  seatId: string;
  feePlanId: string;
  fullName: string;
  phone: string;
  email?: string;
  guardianPhone?: string;
  guardianName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
}
