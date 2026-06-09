import crypto from 'node:crypto';
import type { SortOrder } from 'mongoose';
import { Types } from 'mongoose';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { enrichRowsWithLookups } from '@utils/display-enrichment.util';
import { buildPaginationMeta, resolvePagination } from '@utils/pagination';
import { BranchModel } from '@modules/library/library.models';
import { seatService } from '@modules/seats/seat.service';
import { AttendanceModel } from '@modules/attendance/attendance.models';
import { signAttendanceQrToken } from '@modules/attendance/attendance-qr-token';
import { SeatModel } from '@modules/seats/seats.models';
import { UserModel, RoleModel } from '@modules/auth/auth.models';
import { paymentService } from '@modules/payments/payment.service';
import { logActivity } from '@modules/activity/activity-audit.service';
import { PLAN_LIMIT_ENTITY } from '@modules/subscription-billing/subscription-limit.constants';
import { subscriptionLimitService } from '@modules/subscription-billing/subscription-limit.service';

import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

import { StudentModel } from './students.models';
import { mediaPublicIdFromField } from '@utils/media-asset.schema';
import { applyMediaAssetUpdate } from '@/services/upload.service';
import { deleteStudentMedia } from '@/services/media-cleanup.service';
import {
  studentHasFinancialLinks,
  softDeleteStudentRecord,
} from '@/services/tenant-cleanup.service';

import { buildMembershipFilterClauses } from './membership-query.util';
import { processDocumentProofUpload, processProfilePhotoUpload } from './student-upload.service';
import type { IStudentDocument } from './student.model';

export type StudentUploadFiles = {
  profilePhoto?: Express.Multer.File;
  documentProof?: Express.Multer.File;
};

export const applyStudentUploads = async (
  student: IStudentDocument,
  files?: StudentUploadFiles,
): Promise<void> => {
  if (!files?.profilePhoto && !files?.documentProof) return;

  if (files.profilePhoto) {
    student.profilePhoto = await processProfilePhotoUpload(
      files.profilePhoto,
      mediaPublicIdFromField(student.profilePhoto),
    );
  }
  if (files.documentProof) {
    student.documentProof = await processDocumentProofUpload(
      files.documentProof,
      mediaPublicIdFromField(student.documentProof),
    );
  }
  await student.save();
};

const applyPreUploadedStudentMedia = async (
  student: IStudentDocument,
  input: { profilePhoto?: unknown; documentProof?: unknown },
): Promise<void> => {
  let changed = false;
  if (input.profilePhoto !== undefined) {
    const next = await applyMediaAssetUpdate(student.profilePhoto, input.profilePhoto);
    if (next !== undefined) {
      student.profilePhoto = next ?? undefined;
      changed = true;
    }
  }
  if (input.documentProof !== undefined) {
    const next = await applyMediaAssetUpdate(student.documentProof, input.documentProof);
    if (next !== undefined) {
      student.documentProof = (next ?? undefined) as IStudentDocument['documentProof'];
      changed = true;
    }
  }
  if (changed) await student.save();
};
import { STUDENT_STATUS } from './student.constants';
import {
  DELETED_RELEASE_REASON,
  INACTIVE_RELEASE_REASON,
  releaseStudentSeatsWithAudit,
} from './student-seat-release.service';
import type {
  AssignSeatInput,
  CreateStudentInput,
  ListStudentsQuery,
  TransferStudentInput,
  UpdateStudentInput,
} from './student.validation';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

const hasFullStudentRead = (user: AuthenticatedUser): boolean =>
  user.role === ROLES.SUPER_ADMIN || user.permissions.includes(PERMISSIONS.STUDENT_READ);

const hasBasicStudentRead = (user: AuthenticatedUser): boolean =>
  user.permissions.includes(PERMISSIONS.STUDENT_READ_BASIC);

const assertCanReadStudent = (user: AuthenticatedUser): void => {
  if (hasFullStudentRead(user) || hasBasicStudentRead(user)) return;
  throw ApiError.forbidden('Insufficient permissions to view students');
};

const requireLibraryContext = (user: AuthenticatedUser): string => {
  if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
  return user.libraryId;
};

const assertBranchInLibrary = async (branchId: string, libraryId: Types.ObjectId): Promise<void> => {
  const branch = await BranchModel.findOne({
    _id: new Types.ObjectId(branchId),
    libraryId,
  }).lean();
  if (!branch) throw ApiError.badRequest('Branch not found for this library');
};

const applyListScope = (
  user: AuthenticatedUser,
  query: ListStudentsQuery,
): { filter: Record<string, unknown>; libraryScope: Types.ObjectId | null } => {
  const filter: Record<string, unknown> = {};

  if (user.role === ROLES.SUPER_ADMIN) {
    if (query.libraryId) filter.libraryId = new Types.ObjectId(query.libraryId);
    if (query.branchId) filter.branchId = new Types.ObjectId(query.branchId);
    return { filter, libraryScope: query.libraryId ? new Types.ObjectId(query.libraryId) : null };
  }

  if (!user.libraryId) throw ApiError.forbidden('Tenant library context required');
  const libId = new Types.ObjectId(user.libraryId);
  filter.libraryId = libId;

  if (user.branchId) {
    filter.branchId = new Types.ObjectId(user.branchId);
  } else if (query.branchId) {
    filter.branchId = new Types.ObjectId(query.branchId);
  }

  return { filter, libraryScope: libId };
};

const assertStudentRowAccess = async (user: AuthenticatedUser, student: IStudentDocument): Promise<void> => {
  if (user.role === ROLES.SUPER_ADMIN) return;

  if (!user.libraryId || user.libraryId !== String(student.libraryId)) {
    throw ApiError.forbidden('You do not have access to this student');
  }

  if (user.branchId && user.branchId !== String(student.branchId)) {
    throw ApiError.forbidden('You do not have access to this student');
  }
};

const projectStudent = (user: AuthenticatedUser, student: Record<string, unknown>): Record<string, unknown> => {
  if (hasFullStudentRead(user)) return student;
  if (hasBasicStudentRead(user)) {
    return {
      _id: student._id,
      studentId: student.studentId,
      fullName: student.fullName,
      profilePhoto: student.profilePhoto,
      libraryId: student.libraryId,
      branchId: student.branchId,
      status: student.status,
      membershipEndDate: student.membershipEndDate,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }
  return student;
};

async function allocateStudentId(libraryId: Types.ObjectId): Promise<string> {
  for (let i = 0; i < 16; i += 1) {
    const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
    const candidate = `STU-${suffix}`;
    const exists = await StudentModel.exists({ libraryId, studentId: candidate });
    if (!exists) return candidate;
  }
  throw ApiError.internal('Unable to generate a unique studentId');
}

class StudentService {
  private async resolveStudentByAuthUser(user: AuthenticatedUser) {
    if (user.role !== ROLES.STUDENT) {
      throw ApiError.forbidden('Student account required');
    }
    const student = await StudentModel.findOne({ userId: new Types.ObjectId(user.id) }).lean();
    if (!student) throw ApiError.notFound('Student profile not linked to this user');
    return student;
  }

  async listStudents(user: AuthenticatedUser, query: ListStudentsQuery) {
    assertCanReadStudent(user);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const { filter: scopeFilter, libraryScope } = applyListScope(user, query);

    if (user.role !== ROLES.SUPER_ADMIN && query.branchId && !user.branchId && libraryScope) {
      await assertBranchInLibrary(query.branchId, libraryScope);
    }

    const filter: Record<string, unknown> = { ...scopeFilter };

    if (query.status) filter.status = query.status;

    const andClauses: Record<string, unknown>[] = buildMembershipFilterClauses({
      membershipStatus: query.membershipStatus,
      expiringIn: query.expiringIn,
      membershipEndFrom: query.membershipEndFrom,
      membershipEndTo: query.membershipEndTo,
      membershipFilter: query.membershipFilter,
      membershipExpired: query.membershipExpired,
    });

    if (query.shiftId) {
      const studentIds = await SeatAssignmentModel.distinct('studentId', {
        shiftId: new Types.ObjectId(query.shiftId),
        status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
        ...scopeFilter,
      });
      andClauses.push({ _id: { $in: studentIds } });
    }

    if (query.membershipExpiresBefore) {
      andClauses.push({ membershipEndDate: { $lte: query.membershipExpiresBefore } });
    }
    if (query.membershipExpiresAfter) {
      andClauses.push({ membershipEndDate: { $gte: query.membershipExpiresAfter } });
    }

    if (andClauses.length > 0) {
      filter.$and = [...(Array.isArray(filter.$and) ? (filter.$and as unknown[]) : []), ...andClauses];
    }

    if (query.search) {
      const rx = new RegExp(escapeRegex(query.search), 'i');
      const searchOr: Record<string, unknown>[] = [
        { fullName: rx },
        { studentId: rx },
        { email: rx },
        { phone: rx },
        { city: rx },
      ];
      const seatFilter: Record<string, unknown> = { seatNumber: rx };
      if (filter.libraryId) seatFilter.libraryId = filter.libraryId;
      if (filter.branchId) seatFilter.branchId = filter.branchId;
      const matchingSeats = await SeatModel.find(seatFilter).select('_id').limit(40).lean();
      if (matchingSeats.length) {
        searchOr.push({ assignedSeatId: { $in: matchingSeats.map((s) => s._id) } });
      }
      if (filter.$and) {
        (filter.$and as unknown[]).push({ $or: searchOr });
      } else {
        filter.$or = searchOr;
      }
    }

    const sort: Record<string, SortOrder> = {
      [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1,
    };

    const [rawItems, total] = await Promise.all([
      StudentModel.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      StudentModel.countDocuments(filter),
    ]);

    const items = rawItems.map((s) => projectStudent(user, s as unknown as Record<string, unknown>));
    const enriched = await enrichRowsWithLookups(items as Record<string, unknown>[], {
      branchIdKey: 'branchId',
      seatIdKey: 'assignedSeatId',
    });

    return {
      items: enriched,
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getStudentById(user: AuthenticatedUser, id: string) {
    assertCanReadStudent(user);
    const student = await StudentModel.findById(id);
    if (!student) throw ApiError.notFound('Student not found');
    await assertStudentRowAccess(user, student);
    const projected = projectStudent(user, student.toObject() as unknown as Record<string, unknown>);
    const [enriched] = await enrichRowsWithLookups([projected as Record<string, unknown>], {
      branchIdKey: 'branchId',
      seatIdKey: 'assignedSeatId',
    });
    return this.enrichStudentSeatShifts(enriched as Record<string, unknown>);
  }

  async getStudentSummary(user: AuthenticatedUser, id: string) {
    assertCanReadStudent(user);
    const student = await StudentModel.findById(id).lean();
    if (!student) throw ApiError.notFound('Student not found');
    await assertStudentRowAccess(user, student as unknown as IStudentDocument);

    const base = {
      student: projectStudent(user, student as unknown as Record<string, unknown>),
      attendance: { sessionsLast30d: 0, lastCheckInAt: null as string | null },
      payments: { outstandingAmount: 0, currency: 'INR', lastPaymentAt: null as string | null },
      membership: {
        status: student.status,
        startDate: student.membershipStartDate,
        endDate: student.membershipEndDate,
        isExpired: student.membershipEndDate ? new Date(student.membershipEndDate) < new Date() : false,
      },
    };

    if (user.role === ROLES.SUPER_ADMIN || user.permissions.includes(PERMISSIONS.PAYMENT_READ)) {
      try {
        const snap = await paymentService.getStudentPaymentSnapshot(user, id);
        base.payments = {
          outstandingAmount: snap.outstandingAmount,
          currency: snap.currency,
          lastPaymentAt: snap.lastPaymentAt,
        };
      } catch {
        /* leave placeholder if payments unavailable */
      }
    }

    return base;
  }

  async createStudent(
    user: AuthenticatedUser,
    input: CreateStudentInput,
    files?: StudentUploadFiles,
  ) {
    if (!user.permissions.includes(PERMISSIONS.STUDENT_CREATE)) {
      throw ApiError.forbidden('Insufficient permissions to create students');
    }

    const branch = await BranchModel.findById(input.branchId).lean();
    if (!branch) throw ApiError.badRequest('Branch not found');
    const libraryId = branch.libraryId as Types.ObjectId;

    if (user.role !== ROLES.SUPER_ADMIN) {
      requireLibraryContext(user);
      if (user.libraryId !== String(libraryId)) {
        throw ApiError.forbidden('Branch is not part of your library');
      }
      if (user.branchId && user.branchId !== String(branch._id)) {
        throw ApiError.forbidden('You can only admit students to your branch');
      }
    }

    if (input.assignedSeatId && !user.permissions.includes(PERMISSIONS.STUDENT_ASSIGN_SEAT)) {
      throw ApiError.forbidden('Insufficient permissions to assign seats on admission');
    }

    const studentId = input.studentId?.trim() || (await allocateStudentId(libraryId));

    const existingSid = await StudentModel.exists({ libraryId, studentId });
    if (existingSid) throw ApiError.conflict('studentId already exists in this library');

    await subscriptionLimitService.validateLimitBeforeCreate(
      PLAN_LIMIT_ENTITY.STUDENTS,
      String(libraryId),
      { actorUserId: user.id },
    );

    const now = new Date();
    const admissionDate = input.admissionDate ?? now;
    const membershipStartDate = input.membershipStartDate ?? admissionDate;

    const doc = await StudentModel.create({
      libraryId,
      branchId: branch._id,
      studentId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      gender: input.gender ?? undefined,
      dateOfBirth: input.dateOfBirth ?? undefined,
      address: input.address,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      emergencyContactName: input.emergencyContactName,
      emergencyContactPhone: input.emergencyContactPhone,
      guardianName: input.guardianName,
      guardianPhone: input.guardianPhone,
      aadhaarNumber: input.aadhaarNumber,
      admissionDate,
      membershipStartDate,
      membershipEndDate: input.membershipEndDate ?? undefined,
      status: input.status ?? STUDENT_STATUS.ACTIVE,
      notes: input.notes,
      assignedSeatId: input.assignedSeatId ? new Types.ObjectId(input.assignedSeatId) : null,
      userId: null,
    });

    if (input.createLoginAccount) {
      const existingUser = await UserModel.findOne({ email: input.email.trim().toLowerCase() }).lean();
      if (existingUser) {
        await StudentModel.deleteOne({ _id: doc._id });
        throw ApiError.conflict('A user account already exists with this email');
      }
      const studentRole = await RoleModel.findOne({ name: ROLES.STUDENT, isSystem: true, libraryId: null }).lean();
      if (!studentRole) {
        await StudentModel.deleteOne({ _id: doc._id });
        throw ApiError.internal('System role "STUDENT" not found. Run npm run seed:rbac.');
      }
      const passwordHash = await UserModel.hashPassword(input.temporaryPassword!);
      const userDoc = await UserModel.create({
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone?.trim(),
        passwordHash,
        role: studentRole._id,
        libraryId,
        branchId: branch._id,
        isActive: true,
        isEmailVerified: false,
        refreshTokens: [],
      });
      doc.userId = userDoc._id as Types.ObjectId;
      await doc.save();
    }

    if (input.assignedSeatId) {
      await seatService.syncAfterStudentSeatChange(
        user,
        String(doc._id),
        null,
        input.assignedSeatId,
        input.shiftId,
      );
    }

    if (files?.profilePhoto || files?.documentProof) {
      try {
        await applyStudentUploads(doc, files);
      } catch (err) {
        await StudentModel.deleteOne({ _id: doc._id });
        throw err;
      }
    } else if (input.profilePhoto !== undefined || input.documentProof !== undefined) {
      try {
        await applyPreUploadedStudentMedia(doc, input);
      } catch (err) {
        await StudentModel.deleteOne({ _id: doc._id });
        throw err;
      }
    }

    const created = await StudentModel.findById(doc._id).lean();
    logActivity({
      actorUserId: user.id,
      action: 'STUDENT_CREATED',
      entityType: 'STUDENT',
      entityId: String(doc._id),
      libraryId: String(libraryId),
      branchId: String(branch._id),
      metadata: {
        studentName: input.fullName,
        entityLabel: input.fullName,
        description: `Student ${studentId} admitted`,
      },
    });
    return toJSON(created);
  }

  async getMyStudentProfile(user: AuthenticatedUser) {
    const student = await this.resolveStudentByAuthUser(user);
    return toJSON(student);
  }

  async getMyAttendance(user: AuthenticatedUser, query: ListStudentsQuery) {
    const student = await this.resolveStudentByAuthUser(user);
    const { page, limit, skip } = resolvePagination({ page: query.page, limit: query.limit });
    const filter: Record<string, unknown> = {
      libraryId: student.libraryId,
      branchId: student.branchId,
      studentId: student._id,
    };
    if (query.membershipExpiresAfter) {
      filter.date = { ...(filter.date as Record<string, unknown>), $gte: query.membershipExpiresAfter };
    }
    if (query.membershipExpiresBefore) {
      filter.date = { ...(filter.date as Record<string, unknown>), $lte: query.membershipExpiresBefore };
    }
    const [items, total] = await Promise.all([
      AttendanceModel.find(filter).sort({ date: -1, checkInAt: -1 }).skip(skip).limit(limit).lean(),
      AttendanceModel.countDocuments(filter),
    ]);
    return {
      items: items.map((i) => toJSON(i)),
      meta: { pagination: buildPaginationMeta(total, page, limit) },
    };
  }

  async getMyPayments(user: AuthenticatedUser) {
    return paymentService.getStudentPortalWallet(user);
  }

  async getMySeat(user: AuthenticatedUser) {
    const student = await this.resolveStudentByAuthUser(user);
    if (!student.assignedSeatId) return null;
    const [seat, branch, assignments] = await Promise.all([
      SeatModel.findOne({
        _id: student.assignedSeatId,
        libraryId: student.libraryId,
        branchId: student.branchId,
      }).lean(),
      BranchModel.findById(student.branchId).select('branchName branchCode').lean(),
      SeatAssignmentModel.find({
        studentId: student._id,
        status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
      })
        .populate('shiftId', 'name startTime endTime type color')
        .lean(),
    ]);
    if (!seat) return null;
    const shifts = assignments.map((a) => {
      const sh = a.shiftId as {
        name?: string;
        startTime?: string;
        endTime?: string;
        type?: string;
      } | null;
      return {
        name: sh?.name ?? 'Shift',
        startTime: sh?.startTime ?? '',
        endTime: sh?.endTime ?? '',
        type: sh?.type ?? '',
      };
    });
    return {
      seatNumber: seat.seatNumber,
      floor: seat.floor,
      zone: seat.zone,
      seatType: seat.seatType,
      shifts,
      shiftType: shifts.map((s) => s.name).join(', ') || null,
      status: seat.status,
      occupied: seat.occupied,
      notes: seat.notes ?? null,
      branchName: branch?.branchName ? String(branch.branchName) : null,
      branchCode: branch?.branchCode ? String(branch.branchCode) : null,
      assignedAt: seat.updatedAt ? new Date(seat.updatedAt).toISOString() : null,
    };
  }

  async getMyAttendanceQr(user: AuthenticatedUser) {
    const student = await this.resolveStudentByAuthUser(user);
    const { token, expiresAt } = signAttendanceQrToken({
      sid: String(student._id),
      lid: String(student.libraryId),
      bid: String(student.branchId),
    });
    const [branch, seatDoc] = await Promise.all([
      BranchModel.findById(student.branchId).select('branchName branchCode').lean(),
      student.assignedSeatId
        ? SeatModel.findById(student.assignedSeatId).select('seatNumber').lean()
        : Promise.resolve(null),
    ]);
    return {
      qrToken: token,
      expiresAt,
      fullName: student.fullName ?? '',
      studentCode: student.studentId ?? '',
      branchName: branch?.branchName ?? null,
      branchCode: branch?.branchCode ?? null,
      seatNumber: seatDoc?.seatNumber != null ? String(seatDoc.seatNumber) : null,
    };
  }

  async updateStudent(
    user: AuthenticatedUser,
    id: string,
    input: UpdateStudentInput,
    files?: StudentUploadFiles,
  ) {
    if (!user.permissions.includes(PERMISSIONS.STUDENT_UPDATE)) {
      throw ApiError.forbidden('Insufficient permissions to update students');
    }

    const student = await StudentModel.findById(id);
    if (!student) throw ApiError.notFound('Student not found');
    await assertStudentRowAccess(user, student);
    const previousStatus = student.status;

    if (input.studentId && input.studentId !== student.studentId) {
      if (!user.permissions.includes(PERMISSIONS.LIBRARY_CREATE)) {
        throw ApiError.forbidden('Only platform administrators can change studentId');
      }
      const clash = await StudentModel.exists({
        libraryId: student.libraryId,
        studentId: input.studentId,
        _id: { $ne: student._id },
      });
      if (clash) throw ApiError.conflict('studentId already exists in this library');
      student.studentId = input.studentId;
    }

    const assignable = [
      'fullName',
      'email',
      'phone',
      'gender',
      'dateOfBirth',
      'address',
      'city',
      'state',
      'pincode',
      'emergencyContactName',
      'emergencyContactPhone',
      'guardianName',
      'guardianPhone',
      'aadhaarNumber',
      'admissionDate',
      'membershipStartDate',
      'membershipEndDate',
      'status',
      'notes',
    ] as const;

    for (const key of assignable) {
      const v = input[key];
      if (v !== undefined) {
        (student as unknown as Record<string, unknown>)[key] = v;
      }
    }

    const becameInactive =
      input.status !== undefined &&
      input.status !== STUDENT_STATUS.ACTIVE &&
      previousStatus === STUDENT_STATUS.ACTIVE;

    if (becameInactive) {
      await releaseStudentSeatsWithAudit({
        studentId: String(student._id),
        reason: INACTIVE_RELEASE_REASON,
        actorUserId: user.id,
      });
      student.assignedSeatId = null;
      student.currentShiftId = null;
    }

    if (input.assignedSeatId !== undefined && student.status === STUDENT_STATUS.ACTIVE) {
      if (!user.permissions.includes(PERMISSIONS.STUDENT_ASSIGN_SEAT)) {
        throw ApiError.forbidden('Insufficient permissions to assign seats on student records');
      }
      const prevSeat = student.assignedSeatId ? String(student.assignedSeatId) : null;
      const nextSeat = input.assignedSeatId ? String(input.assignedSeatId) : null;
      const seatChanged = prevSeat !== nextSeat;
      const shiftChanged =
        Boolean(input.shiftId) &&
        String(student.currentShiftId ?? '') !== String(input.shiftId);
      if (seatChanged || shiftChanged || input.assignedSeatId === null) {
        await seatService.syncAfterStudentSeatChange(
          user,
          String(student._id),
          prevSeat,
          nextSeat,
          input.shiftId,
        );
        student.assignedSeatId = input.assignedSeatId
          ? new Types.ObjectId(input.assignedSeatId)
          : null;
        if (input.shiftId) {
          student.currentShiftId = new Types.ObjectId(input.shiftId);
        } else if (!input.assignedSeatId) {
          student.currentShiftId = null;
        }
      }
    }

    if (files?.profilePhoto || files?.documentProof) {
      await applyStudentUploads(student, files);
    } else {
      if (input.profilePhoto !== undefined || input.documentProof !== undefined) {
        await applyPreUploadedStudentMedia(student, input);
      }
      await student.save();
    }
    logActivity({
      actorUserId: user.id,
      action: 'STUDENT_UPDATED',
      entityType: 'STUDENT',
      entityId: String(student._id),
      libraryId: String(student.libraryId),
      branchId: String(student.branchId),
      metadata: {
        studentName: student.fullName,
        entityLabel: student.fullName,
        description: `Student profile updated`,
      },
    });
    return toJSON(student.toObject());
  }

  async deleteStudent(user: AuthenticatedUser, id: string) {
    if (
      user.role !== ROLES.SUPER_ADMIN &&
      !user.permissions.includes(PERMISSIONS.STUDENT_DELETE)
    ) {
      throw ApiError.forbidden('Insufficient permissions to delete students');
    }
    const student = await StudentModel.findById(id);
    if (!student) throw ApiError.notFound('Student not found');
    await assertStudentRowAccess(user, student);
    await releaseStudentSeatsWithAudit({
      studentId: String(student._id),
      reason: DELETED_RELEASE_REASON,
      actorUserId: user.id,
    });

    const hasFinancial = await studentHasFinancialLinks(String(student._id));
    if (hasFinancial) {
      await softDeleteStudentRecord(String(student._id));
      if (student.userId) {
        await UserModel.updateOne(
          { _id: student.userId },
          { $set: { isActive: false, status: 'DELETED' }, $setOnInsert: {} },
        );
      }
      return { id: String(student._id), softDeleted: true };
    }

    await deleteStudentMedia(student);
    if (student.userId) {
      await UserModel.deleteOne({ _id: student.userId });
    }
    await StudentModel.deleteOne({ _id: student._id });
    return { id: String(student._id), softDeleted: false };
  }

  async transferBranch(user: AuthenticatedUser, id: string, input: TransferStudentInput) {
    if (!user.permissions.includes(PERMISSIONS.STUDENT_TRANSFER)) {
      throw ApiError.forbidden('Insufficient permissions to transfer students');
    }
    const student = await StudentModel.findById(id);
    if (!student) throw ApiError.notFound('Student not found');
    await assertStudentRowAccess(user, student);

    const branch = await BranchModel.findById(input.branchId).lean();
    if (!branch) throw ApiError.badRequest('Target branch not found');
    if (String(branch.libraryId) !== String(student.libraryId)) {
      throw ApiError.badRequest('Target branch must belong to the same library');
    }

    const oldSeatId = student.assignedSeatId ? String(student.assignedSeatId) : null;

    student.branchId = branch._id as Types.ObjectId;
    student.assignedSeatId = null;
    await student.save();
    if (oldSeatId) {
      await seatService.vacateSeatIfAssignedToStudent(oldSeatId, String(student._id));
    }
    return toJSON(student.toObject());
  }

  async assignSeat(user: AuthenticatedUser, id: string, input: AssignSeatInput) {
    if (!user.permissions.includes(PERMISSIONS.STUDENT_ASSIGN_SEAT)) {
      throw ApiError.forbidden('Insufficient permissions to assign seats');
    }
    const student = await StudentModel.findById(id);
    if (!student) throw ApiError.notFound('Student not found');
    await assertStudentRowAccess(user, student);

    const prev = student.assignedSeatId ? String(student.assignedSeatId) : null;
    const next = input.assignedSeatId === null ? null : String(input.assignedSeatId);
    await seatService.syncAfterStudentSeatChange(
      user,
      String(student._id),
      prev,
      next,
      input.shiftId,
    );
    student.assignedSeatId =
      input.assignedSeatId === null ? null : new Types.ObjectId(input.assignedSeatId);
    await student.save();
    const refreshed = await StudentModel.findById(student._id).lean();
    logActivity({
      actorUserId: user.id,
      action: next ? 'SEAT_ASSIGNED' : 'SEAT_UNASSIGNED',
      entityType: 'SEAT',
      entityId: next,
      libraryId: String(student.libraryId),
      branchId: String(student.branchId),
      metadata: {
        studentName: student.fullName,
        entityLabel: student.fullName,
        description: next ? `Seat assigned to ${student.fullName}` : `Seat unassigned from ${student.fullName}`,
      },
    });
    return toJSON(refreshed ?? student.toObject());
  }

  private async enrichStudentSeatShifts(
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    if (!row._id) return row;
    const assignments = await SeatAssignmentModel.find({
      studentId: row._id,
      status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
    })
      .populate('shiftId', 'name startTime endTime type color')
      .populate('seatId', 'seatNumber floor zone')
      .lean();

    const shiftLabels = assignments
      .map((a) => {
        const sh = a.shiftId as { name?: string } | null;
        return sh?.name ? String(sh.name) : null;
      })
      .filter(Boolean);

    return {
      ...row,
      seatShiftAssignments: assignments.map((a) => toJSON(a)),
      shiftType: shiftLabels.length ? shiftLabels.join(', ') : row.shiftType ?? null,
    };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const studentService = new StudentService();

export const __studentTestables = {
  applyListScope,
  projectStudent,
  hasFullStudentRead,
  hasBasicStudentRead,
};
