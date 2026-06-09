export type AnalyticsRangePreset = '7d' | '30d' | '90d' | '365d' | 'custom';

export interface AnalyticsQueryParams {
  libraryId?: string;
  branchId?: string;
  fromDate?: string;
  toDate?: string;
  range?: AnalyticsRangePreset;
}

export interface AnalyticsOverview {
  scope: { libraryId: string | null; branchId: string | null };
  totalStudents: number | null;
  activeStudents: number | null;
  inactiveStudents: number | null;
  totalSeats: number | null;
  occupiedSeats: number | null;
  availableSeats: number | null;
  reservedSeats: number | null;
  maintenanceSeats: number | null;
  occupancyPct: number | null;
  activeCheckIns: number | null;
  todayAttendance: number | null;
  totalInvoices: number | null;
  unpaidInvoices: number | null;
  overdueInvoices: number | null;
  totalRevenue: number | null;
  monthlyRevenue: number | null;
  todayCollection: number | null;
  pendingDues: number | null;
  platform?: {
    activeLibraries: number;
    platformRevenue365d: number;
    topLibrariesByRevenue: Array<{ libraryId: string; name: string; revenue: number }>;
  } | null;
}

export interface DailyTrendPoint {
  date: string;
  revenue: number;
  attendance: number;
  newStudents: number;
}

export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  attendance: number;
}
