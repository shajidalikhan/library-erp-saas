import type { ReportType } from './reports-columns.constants';
import { REPORT_COLUMNS, resolveReportColumns } from './reports-columns.constants';

export function mapStudentExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    studentCode: row.studentId ?? row.studentCode ?? '',
    fullName: row.fullName ?? '',
    email: row.email ?? '',
    phone: row.phone ?? '',
    status: row.status ?? '',
    branchName: row.branchName ?? '',
    seatNumber: row.seatNumber ?? '',
    admissionDate: row.admissionDate ?? '',
    membershipStartDate: row.membershipStartDate ?? '',
    membershipEndDate: row.membershipEndDate ?? '',
    createdAt: row.createdAt ?? '',
  };
}

export function mapAttendanceExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    studentName: row.studentName ?? '',
    studentCode: row.studentCode ?? '',
    branchName: row.branchName ?? '',
    seatNumber: row.seatNumber ?? '',
    date: row.date ?? '',
    checkInAt: row.checkInAt ?? '',
    checkOutAt: row.checkOutAt ?? '',
    durationMinutes: row.durationMinutes ?? '',
    status: row.status ?? '',
    method: row.method ?? '',
  };
}

export function mapPaymentExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    receiptNumber: row.receiptNumber ?? '',
    invoiceNumber: row.invoiceNumber ?? '',
    studentName: row.studentName ?? '',
    studentCode: row.studentCode ?? '',
    branchName: row.branchName ?? '',
    amount: row.amount ?? '',
    method: row.method ?? '',
    paidAt: row.paidAt ?? '',
    status: row.status ?? '',
    receivedByName: row.receivedByName ?? '',
  };
}

export function mapInvoiceExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    invoiceNumber: row.invoiceNumber ?? '',
    studentName: row.studentName ?? '',
    studentCode: row.studentCode ?? '',
    branchName: row.branchName ?? '',
    totalAmount: row.totalAmount ?? '',
    paidAmount: row.paidAmount ?? '',
    dueAmount: row.dueAmount ?? '',
    status: row.status ?? '',
    dueDate: row.dueDate ?? '',
    currency: row.currency ?? '',
    createdAt: row.createdAt ?? '',
  };
}

export function mapSeatExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    seatNumber: row.seatNumber ?? '',
    floor: row.floor ?? '',
    zone: row.zone ?? '',
    seatType: row.seatType ?? '',
    shiftOccupancy: row.shiftOccupancy ?? row.shiftType ?? '',
    status: row.status ?? '',
    occupied: row.occupied ?? '',
    branchName: row.branchName ?? '',
    assignedStudentName: row.assignedStudentName ?? '',
    assignedStudentCode: row.assignedStudentCode ?? row.studentCode ?? '',
    updatedAt: row.updatedAt ?? '',
  };
}

export function mapBranchExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    branchName: row.branchName ?? '',
    branchCode: row.branchCode ?? '',
    libraryName: row.libraryName ?? '',
    city: row.city ?? '',
    active: row.active ?? '',
    totalSeats: row.totalSeats ?? '',
    studentCount: row.studentCount ?? '',
    collectionAmount: row.collectionAmount ?? '',
  };
}

export function mapCollectionExportRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    branchName: row.branchName ?? '',
    libraryName: row.libraryName ?? '',
    collectionAmount: row.collectionAmount ?? '',
    paymentCount: row.paymentCount ?? '',
  };
}

const ROW_MAPPERS: Record<ReportType, (row: Record<string, unknown>) => Record<string, unknown>> = {
  students: mapStudentExportRow,
  attendance: mapAttendanceExportRow,
  payments: mapPaymentExportRow,
  invoices: mapInvoiceExportRow,
  seats: mapSeatExportRow,
  dues: mapInvoiceExportRow,
  branches: mapBranchExportRow,
  collections: mapCollectionExportRow,
};

export function prepareExportRows(
  report: ReportType,
  rows: Record<string, unknown>[],
  requestedColumns?: string[],
): { columns: string[]; rows: Record<string, unknown>[] } {
  const { keys, labels } = resolveReportColumns(report, requestedColumns);
  const mapper = ROW_MAPPERS[report];
  const mapped = rows.map((r) => {
    const flat = mapper(r);
    const out: Record<string, unknown> = {};
    keys.forEach((k, i) => {
      out[labels[i] ?? k] = flat[k] ?? '';
    });
    return out;
  });
  return { columns: labels, rows: mapped };
}

export function parseColumnsQuery(raw?: string): string[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function columnDefsForReport(report: ReportType) {
  return REPORT_COLUMNS[report];
}
