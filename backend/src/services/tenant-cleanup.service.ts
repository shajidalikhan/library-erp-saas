import { Types } from 'mongoose';

import { UserModel } from '@modules/auth/auth.models';
import { AttendanceModel } from '@modules/attendance/attendance.model';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { MembershipModel } from '@modules/membership/membership.model';
import { NotificationModel } from '@modules/notifications/notification.model';
import { NotificationLogModel } from '@modules/notifications/notification-log.model';
import { NotificationTemplateModel } from '@modules/notifications/notification-template.model';
import {
  FeePlanModel,
  InvoiceModel,
  PaymentRecordModel,
  RefundModel,
} from '@modules/payments/payments.models';
import { AuditLogModel } from '@modules/platform/audit-log.model';
import { TenantUsageSnapshotModel } from '@modules/platform/tenant-usage-snapshot.model';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { SeatModel } from '@modules/seats/seat.model';
import { ShiftModel } from '@modules/shifts/shift.model';
import { LibrarySubscriptionModel } from '@modules/subscription-billing/library-subscription.model';
import { SubscriptionEventModel } from '@modules/subscription-billing/subscription-event.model';
import { StudentFieldConfigModel } from '@modules/students/student-field-config.model';
import { StudentModel } from '@modules/students/students.models';
import { STUDENT_STATUS } from '@modules/students/student.constants';
import { mediaPublicIdFromField } from '@utils/media-asset.schema';

import {
  deleteBranchMedia,
  deleteLibraryMedia,
  deletePublicIds,
  deleteStudentMedia,
} from './media-cleanup.service';

export type BranchDeleteImpact = {
  students: number;
  seats: number;
  staff: number;
};

const libraryOid = (libraryId: string) => new Types.ObjectId(libraryId);
const branchOid = (branchId: string) => new Types.ObjectId(branchId);

export async function getBranchDeleteImpact(
  libraryId: string,
  branchId: string,
): Promise<BranchDeleteImpact> {
  const libId = libraryOid(libraryId);
  const brId = branchOid(branchId);
  const [students, seats, staff] = await Promise.all([
    StudentModel.countDocuments({ libraryId: libId, branchId: brId }),
    SeatModel.countDocuments({ libraryId: libId, branchId: brId }),
    UserModel.countDocuments({ libraryId: libId, branchId: brId }),
  ]);
  return { students, seats, staff };
}

async function collectStudentPublicIds(filter: Record<string, unknown>): Promise<string[]> {
  const students = await StudentModel.find(filter).select('profilePhoto documentProof').lean();
  const ids: string[] = [];
  for (const s of students) {
    const photo = mediaPublicIdFromField(s.profilePhoto);
    const doc = mediaPublicIdFromField(s.documentProof);
    if (photo) ids.push(photo);
    if (doc) ids.push(doc);
  }
  return ids;
}

async function deletePaymentsForInvoices(invoiceIds: Types.ObjectId[]): Promise<void> {
  if (!invoiceIds.length) return;
  const payments = await PaymentRecordModel.find({ invoiceId: { $in: invoiceIds } }).select('_id').lean();
  const paymentIds = payments.map((p) => p._id);
  if (paymentIds.length) {
    await RefundModel.deleteMany({ paymentId: { $in: paymentIds } });
    await PaymentRecordModel.deleteMany({ _id: { $in: paymentIds } });
  }
}

async function deleteFinancialScope(scope: Record<string, unknown>): Promise<void> {
  const invoices = await InvoiceModel.find(scope).select('_id').lean();
  const invoiceIds = invoices.map((i) => i._id as Types.ObjectId);
  await deletePaymentsForInvoices(invoiceIds);
  await InvoiceModel.deleteMany(scope);
  await PaymentRecordModel.deleteMany(scope);
  await RefundModel.deleteMany(scope);
  await FeePlanModel.deleteMany(scope);
}

async function deleteStudentsInScope(scope: Record<string, unknown>): Promise<void> {
  const students = await StudentModel.find(scope).lean();
  const userIds = students.map((s) => s.userId).filter(Boolean) as Types.ObjectId[];
  for (const student of students) {
    await deleteStudentMedia(student);
  }
  if (userIds.length) {
    await UserModel.deleteMany({ _id: { $in: userIds } });
  }
  if (students.length) {
    await StudentModel.deleteMany({ _id: { $in: students.map((s) => s._id) } });
  }
}

async function deleteSeatsInScope(scope: Record<string, unknown>): Promise<void> {
  await SeatAssignmentModel.deleteMany(scope);
  await SeatModel.deleteMany(scope);
}

/**
 * Hard-deletes all data scoped to a branch (seats, students, attendance, branch assets).
 */
export async function cascadeDeleteBranch(libraryId: string, branchId: string): Promise<void> {
  const libId = libraryOid(libraryId);
  const brId = branchOid(branchId);

  const branch = await BranchModel.findOne({ _id: brId, libraryId: libId }).lean();
  if (!branch) return;

  const scope = { libraryId: libId, branchId: brId };

  await deleteFinancialScope(scope);
  await deleteSeatsInScope(scope);
  await AttendanceModel.deleteMany(scope);
  await MembershipModel.deleteMany(scope);
  await ShiftModel.deleteMany(scope);

  const extraIds = await collectStudentPublicIds(scope);
  await deleteStudentsInScope(scope);
  await deletePublicIds(extraIds);

  await NotificationModel.deleteMany({ libraryId: libId, branchId: brId });
  await NotificationLogModel.deleteMany({ libraryId: libId, branchId: brId });
  await UserModel.deleteMany({ libraryId: libId, branchId: brId });

  await deleteBranchMedia(branch);
  await BranchModel.deleteOne({ _id: brId, libraryId: libId });
}

/**
 * Full tenant wipe for a library. Platform SaaS subscription invoices are retained for billing audit.
 */
export async function cascadeDeleteLibrary(libraryId: string): Promise<void> {
  const libId = libraryOid(libraryId);
  const lib = await LibraryModel.findById(libId).lean();
  if (!lib) return;

  const libScope = { libraryId: libId };
  const branches = await BranchModel.find(libScope).select('logo').lean();

  await deleteFinancialScope(libScope);
  await deleteSeatsInScope(libScope);
  await AttendanceModel.deleteMany(libScope);
  await MembershipModel.deleteMany(libScope);
  await ShiftModel.deleteMany(libScope);
  await StudentFieldConfigModel.deleteMany(libScope);

  const extraIds = await collectStudentPublicIds(libScope);
  await deleteStudentsInScope(libScope);
  await deletePublicIds(extraIds);

  for (const branch of branches) {
    await deleteBranchMedia(branch);
  }

  await NotificationModel.deleteMany({ libraryId: libId });
  await NotificationTemplateModel.deleteMany({ libraryId: libId });
  await NotificationLogModel.deleteMany({ libraryId: libId });
  await SubscriptionEventModel.deleteMany(libScope);
  await LibrarySubscriptionModel.deleteMany(libScope);
  await TenantUsageSnapshotModel.deleteMany(libScope);
  await AuditLogModel.deleteMany({ libraryId: libId });

  if (lib.ownerId) {
    await UserModel.updateOne(
      { _id: lib.ownerId },
      { $set: { libraryId: null, branchId: null } },
    );
  }

  await UserModel.deleteMany({ libraryId: libId });
  await BranchModel.deleteMany(libScope);
  await deleteLibraryMedia(lib);
  await LibraryModel.deleteOne({ _id: libId });
}

/** Whether a student has open financial records — soft-delete candidate. */
export async function studentHasFinancialLinks(studentId: string): Promise<boolean> {
  const sid = new Types.ObjectId(studentId);
  const openInvoice = await InvoiceModel.exists({
    studentId: sid,
    status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE', 'DRAFT'] },
  });
  if (openInvoice) return true;
  return Boolean(await PaymentRecordModel.exists({ studentId: sid }));
}

export async function softDeleteStudentRecord(studentId: string): Promise<void> {
  const student = await StudentModel.findById(studentId);
  if (!student) return;
  await deleteStudentMedia(student);
  student.profilePhoto = undefined;
  student.documentProof = undefined;
  student.status = STUDENT_STATUS.INACTIVE;
  student.assignedSeatId = null;
  await student.save();
}
