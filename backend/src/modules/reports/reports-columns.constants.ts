export type ReportColumnDef = { key: string; label: string };

export const REPORT_TYPES = [
  'students',
  'attendance',
  'payments',
  'invoices',
  'seats',
  'dues',
  'branches',
  'collections',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_COLUMNS: Record<ReportType, ReportColumnDef[]> = {
  students: [
    { key: 'studentCode', label: 'Student Code' },
    { key: 'fullName', label: 'Student Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'branchName', label: 'Branch Name' },
    { key: 'seatNumber', label: 'Seat Number' },
    { key: 'admissionDate', label: 'Admission Date' },
    { key: 'membershipStartDate', label: 'Membership Start' },
    { key: 'membershipEndDate', label: 'Membership End' },
    { key: 'createdAt', label: 'Created At' },
  ],
  attendance: [
    { key: 'studentName', label: 'Student Name' },
    { key: 'studentCode', label: 'Student Code' },
    { key: 'branchName', label: 'Branch Name' },
    { key: 'seatNumber', label: 'Seat Number' },
    { key: 'date', label: 'Date' },
    { key: 'checkInAt', label: 'Check In' },
    { key: 'checkOutAt', label: 'Check Out' },
    { key: 'durationMinutes', label: 'Duration (min)' },
    { key: 'status', label: 'Status' },
    { key: 'method', label: 'Method' },
  ],
  payments: [
    { key: 'receiptNumber', label: 'Receipt Number' },
    { key: 'invoiceNumber', label: 'Invoice Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'studentCode', label: 'Student Code' },
    { key: 'branchName', label: 'Branch Name' },
    { key: 'amount', label: 'Amount' },
    { key: 'method', label: 'Method' },
    { key: 'paidAt', label: 'Paid At' },
    { key: 'status', label: 'Status' },
    { key: 'receivedByName', label: 'Received By' },
  ],
  invoices: [
    { key: 'invoiceNumber', label: 'Invoice Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'studentCode', label: 'Student Code' },
    { key: 'branchName', label: 'Branch Name' },
    { key: 'totalAmount', label: 'Total' },
    { key: 'paidAmount', label: 'Paid' },
    { key: 'dueAmount', label: 'Due' },
    { key: 'status', label: 'Status' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'currency', label: 'Currency' },
    { key: 'createdAt', label: 'Created At' },
  ],
  seats: [
    { key: 'seatNumber', label: 'Seat Number' },
    { key: 'floor', label: 'Floor' },
    { key: 'zone', label: 'Zone' },
    { key: 'seatType', label: 'Seat Type' },
    { key: 'shiftOccupancy', label: 'Shift occupancy' },
    { key: 'status', label: 'Status' },
    { key: 'occupied', label: 'Occupied' },
    { key: 'branchName', label: 'Branch Name' },
    { key: 'assignedStudentName', label: 'Student Name' },
    { key: 'assignedStudentCode', label: 'Student Code' },
    { key: 'updatedAt', label: 'Updated At' },
  ],
  dues: [
    { key: 'invoiceNumber', label: 'Invoice Number' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'studentCode', label: 'Student Code' },
    { key: 'branchName', label: 'Branch Name' },
    { key: 'totalAmount', label: 'Total' },
    { key: 'paidAmount', label: 'Paid' },
    { key: 'dueAmount', label: 'Due' },
    { key: 'status', label: 'Status' },
    { key: 'dueDate', label: 'Due Date' },
  ],
  branches: [
    { key: 'branchName', label: 'Branch Name' },
    { key: 'branchCode', label: 'Branch Code' },
    { key: 'libraryName', label: 'Library Name' },
    { key: 'city', label: 'City' },
    { key: 'active', label: 'Active' },
    { key: 'totalSeats', label: 'Total Seats' },
    { key: 'studentCount', label: 'Students' },
    { key: 'collectionAmount', label: 'Collections' },
  ],
  collections: [
    { key: 'branchName', label: 'Branch Name' },
    { key: 'libraryName', label: 'Library Name' },
    { key: 'collectionAmount', label: 'Collection Amount' },
    { key: 'paymentCount', label: 'Payment Count' },
  ],
};

export function defaultColumnKeys(report: ReportType): string[] {
  return REPORT_COLUMNS[report].map((c) => c.key);
}

export function resolveReportColumns(report: ReportType, requested?: string[]): {
  keys: string[];
  labels: string[];
} {
  const allowed = new Map(REPORT_COLUMNS[report].map((c) => [c.key, c.label]));
  const keys =
    requested && requested.length > 0
      ? requested.filter((k) => allowed.has(k))
      : defaultColumnKeys(report);
  const safeKeys = keys.length > 0 ? keys : defaultColumnKeys(report);
  return {
    keys: safeKeys,
    labels: safeKeys.map((k) => allowed.get(k) ?? k),
  };
}
