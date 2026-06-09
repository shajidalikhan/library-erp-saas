import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { UserModel } from '@modules/auth/auth.models';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { StudentModel } from '@modules/students/students.models';
import { SeatModel } from '@modules/seats/seat.model';
import { InvoiceModel, PaymentRecordModel } from '@modules/payments/payments.models';
import { DemoRequestModel } from '@modules/demo-requests/demo-request.model';
import { NotificationModel } from '@modules/notifications/notification.model';
import { AttendanceModel } from '@modules/attendance/attendance.model';

import type { SearchResultKind } from './search.constants';
import type { GlobalSearchQuery } from './search.validation';

export type SearchResultItem = {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string | null;
  hrefPath: string;
  libraryName?: string | null;
  branchName?: string | null;
};

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const rx = (q: string) => new RegExp(escapeRegex(q), 'i');

class SearchService {
  async search(user: AuthenticatedUser, query: GlobalSearchQuery): Promise<{ items: SearchResultItem[] }> {
    const term = query.q.trim();
    if (!term) throw ApiError.badRequest('Search query is required');

    const limit = query.limit;
    const items: SearchResultItem[] = [];
    const push = (rows: SearchResultItem[]) => {
      for (const row of rows) {
        if (items.length >= limit) break;
        items.push(row);
      }
    };

    if (user.role === ROLES.SUPER_ADMIN) {
      push(await this.searchLibraries(term, limit));
      push(await this.searchBranches(term, null, limit));
      push(await this.searchUsers(term, null, null, limit));
      push(await this.searchStudents(term, null, null, limit));
      push(await this.searchInvoices(term, null, null, limit));
      push(await this.searchPayments(term, null, null, limit));
      push(await this.searchDemoRequests(term, limit));
      return { items: items.slice(0, limit) };
    }

    if (user.role === ROLES.STUDENT) {
      push(await this.searchStudentNotifications(user, term, limit));
      push(await this.searchStudentPayments(user, term, limit));
      push(await this.searchStudentAttendance(user, term, limit));
      return { items: items.slice(0, limit) };
    }

    if (!user.libraryId) throw ApiError.forbidden('Library context required');
    const libraryId = user.libraryId;
    const branchId =
      user.branchId && user.role !== ROLES.LIBRARY_OWNER ? user.branchId : null;

    if (user.role === ROLES.LIBRARY_OWNER) {
      push(await this.searchBranches(term, libraryId, limit));
      push(await this.searchUsers(term, libraryId, null, limit));
    }

    if (
      user.permissions.includes(PERMISSIONS.STUDENT_READ) ||
      user.permissions.includes(PERMISSIONS.STUDENT_READ_BASIC)
    ) {
      push(await this.searchStudents(term, libraryId, branchId, limit));
    }
    if (
      user.permissions.includes(PERMISSIONS.SEAT_READ) ||
      user.permissions.includes(PERMISSIONS.SEAT_OCCUPANCY_READ)
    ) {
      push(await this.searchSeats(term, libraryId, branchId, limit));
    }
    if (user.permissions.includes(PERMISSIONS.ATTENDANCE_READ)) {
      push(await this.searchAttendance(term, libraryId, branchId, limit));
    }
    if (user.permissions.includes(PERMISSIONS.PAYMENT_READ)) {
      push(await this.searchInvoices(term, libraryId, branchId, limit));
      push(await this.searchPayments(term, libraryId, branchId, limit));
    }

    return { items: items.slice(0, limit) };
  }

  private async searchLibraries(term: string, limit: number): Promise<SearchResultItem[]> {
    const rows = await LibraryModel.find({
      $or: [{ name: rx(term) }, { slug: rx(term) }, { email: rx(term) }, { city: rx(term) }],
    })
      .select('name slug')
      .limit(limit)
      .lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'library',
      title: String(r.name),
      subtitle: r.slug ? String(r.slug) : null,
      hrefPath: `/dashboard/libraries/${String(r._id)}`,
    }));
  }

  private async searchBranches(
    term: string,
    libraryId: string | null,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const filter: Record<string, unknown> = {
      $or: [{ branchName: rx(term) }, { branchCode: rx(term) }, { city: rx(term) }],
    };
    if (libraryId) filter.libraryId = new Types.ObjectId(libraryId);
    const rows = await BranchModel.find(filter).select('branchName branchCode libraryId').limit(limit).lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'branch',
      title: String(r.branchName),
      subtitle: String(r.branchCode),
      hrefPath: `/dashboard/libraries/${String(r.libraryId)}/branches/${String(r._id)}`,
    }));
  }

  private async searchUsers(
    term: string,
    libraryId: string | null,
    branchId: string | null,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const filter: Record<string, unknown> = {
      $or: [{ fullName: rx(term) }, { email: rx(term) }, { phone: rx(term) }],
    };
    if (libraryId) filter.libraryId = new Types.ObjectId(libraryId);
    if (branchId) filter.branchId = new Types.ObjectId(branchId);
    const rows = await UserModel.find(filter).select('fullName email').limit(limit).lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'user',
      title: String(r.fullName),
      subtitle: String(r.email),
      hrefPath: `/dashboard/users/${String(r._id)}`,
    }));
  }

  private async searchStudents(
    term: string,
    libraryId: string | null,
    branchId: string | null,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const filter: Record<string, unknown> = {
      $or: [{ fullName: rx(term) }, { studentId: rx(term) }, { email: rx(term) }, { phone: rx(term) }],
    };
    if (libraryId) filter.libraryId = new Types.ObjectId(libraryId);
    if (branchId) filter.branchId = new Types.ObjectId(branchId);
    const rows = await StudentModel.find(filter).select('fullName studentId').limit(limit).lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'student',
      title: String(r.fullName),
      subtitle: String(r.studentId),
      hrefPath: `/dashboard/students/${String(r._id)}`,
    }));
  }

  private async searchSeats(
    term: string,
    libraryId: string,
    branchId: string | null,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const filter: Record<string, unknown> = {
      libraryId: new Types.ObjectId(libraryId),
      $or: [{ seatNumber: rx(term) }, { floor: rx(term) }, { zone: rx(term) }],
    };
    if (branchId) filter.branchId = new Types.ObjectId(branchId);
    const rows = await SeatModel.find(filter).select('seatNumber floor zone').limit(limit).lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'seat',
      title: `Seat ${String(r.seatNumber)}`,
      subtitle: [r.floor, r.zone].filter(Boolean).join(' · ') || null,
      hrefPath: `/dashboard/seats/${String(r._id)}`,
    }));
  }

  private async searchInvoices(
    term: string,
    libraryId: string | null,
    branchId: string | null,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const filter: Record<string, unknown> = {
      $or: [{ invoiceNumber: rx(term) }, { notes: rx(term) }],
    };
    if (libraryId) filter.libraryId = new Types.ObjectId(libraryId);
    if (branchId) filter.branchId = new Types.ObjectId(branchId);
    const rows = await InvoiceModel.find(filter).select('invoiceNumber totalAmount status').limit(limit).lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'invoice',
      title: `Invoice ${String(r.invoiceNumber)}`,
      subtitle: `${r.status} · ${r.totalAmount}`,
      hrefPath: `/dashboard/payments/invoices/${String(r._id)}`,
    }));
  }

  private async searchPayments(
    term: string,
    libraryId: string | null,
    branchId: string | null,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const filter: Record<string, unknown> = {
      $or: [{ receiptNumber: rx(term) }, { method: rx(term) }, { notes: rx(term) }],
    };
    if (libraryId) filter.libraryId = new Types.ObjectId(libraryId);
    if (branchId) filter.branchId = new Types.ObjectId(branchId);
    const rows = await PaymentRecordModel.find(filter)
      .select('receiptNumber amount method')
      .limit(limit)
      .lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'payment',
      title: r.receiptNumber ? `Receipt ${String(r.receiptNumber)}` : 'Payment',
      subtitle: `${r.method} · ${r.amount}`,
      hrefPath: `/dashboard/payments/receipts/${String(r._id)}`,
    }));
  }

  private async searchDemoRequests(term: string, limit: number): Promise<SearchResultItem[]> {
    const rows = await DemoRequestModel.find({
      $or: [{ fullName: rx(term) }, { email: rx(term) }, { libraryName: rx(term) }],
    })
      .select('fullName email status')
      .limit(limit)
      .lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'demo_request',
      title: String(r.fullName),
      subtitle: String(r.email),
      hrefPath: `/dashboard/platform/demo-requests/${String(r._id)}`,
    }));
  }

  private async searchStudentNotifications(
    user: AuthenticatedUser,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const rows = await NotificationModel.find({
      recipientUserId: new Types.ObjectId(user.id),
      $or: [{ title: rx(term) }, { message: rx(term) }],
    })
      .select('title message')
      .limit(limit)
      .lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'notification',
      title: String(r.title),
      subtitle: String(r.message).slice(0, 80),
      hrefPath: `/dashboard/notifications/${String(r._id)}`,
    }));
  }

  private async searchStudentPayments(
    user: AuthenticatedUser,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const student = await StudentModel.findOne({ userId: user.id }).select('_id').lean();
    if (!student) return [];
    const rows = await PaymentRecordModel.find({
      studentId: student._id,
      $or: [{ receiptNumber: rx(term) }, { notes: rx(term) }],
    })
      .select('receiptNumber amount')
      .limit(limit)
      .lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'payment',
      title: r.receiptNumber ? `Receipt ${String(r.receiptNumber)}` : 'Payment',
      subtitle: String(r.amount),
      hrefPath: `/dashboard/student/payments`,
    }));
  }

  private async searchStudentAttendance(
    user: AuthenticatedUser,
    term: string,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const student = await StudentModel.findOne({ userId: user.id }).select('_id').lean();
    if (!student) return [];
    const rows = await AttendanceModel.find({
      studentId: student._id,
      $or: [{ status: rx(term) }],
    })
      .select('date status')
      .limit(limit)
      .lean();
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'attendance',
      title: `Attendance ${new Date(r.date).toLocaleDateString()}`,
      subtitle: String(r.status),
      hrefPath: `/dashboard/student/attendance`,
    }));
  }

  private async searchAttendance(
    term: string,
    libraryId: string,
    branchId: string | null,
    limit: number,
  ): Promise<SearchResultItem[]> {
    const filter: Record<string, unknown> = {
      libraryId: new Types.ObjectId(libraryId),
      status: rx(term),
    };
    if (branchId) filter.branchId = new Types.ObjectId(branchId);
    const rows = await AttendanceModel.find(filter).select('date status studentId').limit(limit).lean();
    const studentIds = rows.map((r) => r.studentId);
    const students = await StudentModel.find({ _id: { $in: studentIds } }).select('fullName').lean();
    const nameMap = new Map(students.map((s) => [String(s._id), s.fullName]));
    return rows.map((r) => ({
      id: String(r._id),
      kind: 'attendance',
      title: nameMap.get(String(r.studentId)) ?? 'Attendance',
      subtitle: `${new Date(r.date).toLocaleDateString()} · ${r.status}`,
      hrefPath: `/dashboard/attendance/students/${String(r.studentId)}`,
    }));
  }
}

export const searchService = new SearchService();
