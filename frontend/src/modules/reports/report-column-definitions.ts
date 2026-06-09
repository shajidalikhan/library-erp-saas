export type ReportColumnDef = { key: string; label: string };

export type ReportType =
  | 'students'
  | 'attendance'
  | 'payments'
  | 'invoices'
  | 'seats'
  | 'dues'
  | 'branches'
  | 'collections';

export const REPORT_COLUMN_DEFS: Record<ReportType, ReportColumnDef[]> = {
  students: [
    { key: 'studentCode', label: 'Student Code' },
    { key: 'fullName', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'status', label: 'Status' },
    { key: 'branchName', label: 'Branch' },
    { key: 'seatNumber', label: 'Seat' },
    { key: 'admissionDate', label: 'Admission' },
    { key: 'membershipEndDate', label: 'Membership End' },
  ],
  attendance: [
    { key: 'studentName', label: 'Student' },
    { key: 'studentCode', label: 'Student Code' },
    { key: 'branchName', label: 'Branch' },
    { key: 'seatNumber', label: 'Seat' },
    { key: 'date', label: 'Date' },
    { key: 'checkInAt', label: 'Check In' },
    { key: 'checkOutAt', label: 'Check Out' },
    { key: 'status', label: 'Status' },
  ],
  payments: [
    { key: 'receiptNumber', label: 'Receipt' },
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'studentName', label: 'Student' },
    { key: 'branchName', label: 'Branch' },
    { key: 'amount', label: 'Amount' },
    { key: 'method', label: 'Method' },
    { key: 'paidAt', label: 'Paid At' },
  ],
  invoices: [
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'studentName', label: 'Student' },
    { key: 'branchName', label: 'Branch' },
    { key: 'totalAmount', label: 'Total' },
    { key: 'dueAmount', label: 'Due' },
    { key: 'status', label: 'Status' },
    { key: 'dueDate', label: 'Due Date' },
  ],
  seats: [
    { key: 'seatNumber', label: 'Seat' },
    { key: 'floor', label: 'Floor' },
    { key: 'zone', label: 'Zone' },
    { key: 'status', label: 'Status' },
    { key: 'branchName', label: 'Branch' },
    { key: 'assignedStudentName', label: 'Student' },
  ],
  dues: [
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'studentName', label: 'Student' },
    { key: 'branchName', label: 'Branch' },
    { key: 'dueAmount', label: 'Due' },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'status', label: 'Status' },
  ],
  branches: [
    { key: 'branchName', label: 'Branch' },
    { key: 'branchCode', label: 'Code' },
    { key: 'libraryName', label: 'Library' },
    { key: 'city', label: 'City' },
    { key: 'studentCount', label: 'Students' },
  ],
  collections: [
    { key: 'branchName', label: 'Branch' },
    { key: 'collectionAmount', label: 'Collected' },
    { key: 'paymentCount', label: 'Payments' },
  ],
};

export function defaultReportColumnKeys(report: ReportType): string[] {
  return REPORT_COLUMN_DEFS[report].map((c) => c.key);
}

export function reportPreviewColumns(report: ReportType, selectedKeys: string[]) {
  const defs = REPORT_COLUMN_DEFS[report];
  const keys = selectedKeys.length ? selectedKeys : defaultReportColumnKeys(report);
  return keys
    .map((key) => defs.find((d) => d.key === key))
    .filter((d): d is ReportColumnDef => Boolean(d));
}

/** Map API row fields to preview column keys. */
export function mapStudentPreviewRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    studentCode: row.studentId ?? row.studentCode,
    branchName: row.branchName ?? row.branchCode,
  };
}
