import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

import { ROLES } from '@constants/roles.constants';
import { PERMISSIONS } from '@constants/permissions.constants';
import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { mediaUrlFromField } from '@utils/media-asset.schema';
import { BranchModel, LibraryModel } from '@modules/library/library.models';
import { SeatModel } from '@modules/seats/seat.model';
import { ShiftModel } from '@modules/shifts/shift.model';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

import { StudentModel } from './students.models';
import { fetchImageBufferForPdf, cloudinaryUrlForPdfEmbed } from './id-card-image.util';

const CARD_WIDTH = 340;
const CARD_HEIGHT = 214;
const MARGIN = 14;

const fmtDate = (d?: Date | string | null): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const assertIdCardAccess = (
  user: AuthenticatedUser,
  student: { libraryId: unknown; branchId: unknown; userId?: unknown },
): void => {
  if (user.role === ROLES.SUPER_ADMIN) return;
  if (user.role === ROLES.STUDENT && student.userId && String(student.userId) === user.id) return;
  if (!user.libraryId || user.libraryId !== String(student.libraryId)) {
    throw ApiError.forbidden('You do not have access to this student');
  }
  if (user.branchId && user.branchId !== String(student.branchId)) {
    throw ApiError.forbidden('You do not have access to this student');
  }
};

export async function generateStudentIdCardPdf(
  user: AuthenticatedUser,
  studentId: string,
): Promise<Buffer> {
  const student = await StudentModel.findById(studentId).lean();
  if (!student) throw ApiError.notFound('Student not found');

  const isSelfStudent =
    user.role === ROLES.STUDENT && student.userId && String(student.userId) === user.id;
  if (
    user.role !== ROLES.SUPER_ADMIN &&
    !isSelfStudent &&
    !user.permissions.includes(PERMISSIONS.ID_CARD_GENERATE) &&
    !user.permissions.includes(PERMISSIONS.STUDENT_READ)
  ) {
    throw ApiError.forbidden('Insufficient permissions');
  }
  assertIdCardAccess(user, student);

  const [library, branch, seat, assignment] = await Promise.all([
    LibraryModel.findById(student.libraryId).lean(),
    BranchModel.findById(student.branchId).lean(),
    student.assignedSeatId ? SeatModel.findById(student.assignedSeatId).lean() : null,
    SeatAssignmentModel.findOne({
      studentId: student._id,
      status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  let shiftName = '—';
  if (assignment?.shiftId) {
    const shift = await ShiftModel.findById(assignment.shiftId).lean();
    if (shift) shiftName = shift.name;
  }

  const photoUrl = mediaUrlFromField(student.profilePhoto);
  const libraryLogoUrl = mediaUrlFromField(library?.logo);
  const branchLogoUrl = mediaUrlFromField(branch?.logo);

  const [photoBuf, libraryLogoBuf, branchLogoBuf] = await Promise.all([
    photoUrl ? fetchImageBufferForPdf(photoUrl) : Promise.resolve(null),
    libraryLogoUrl ? fetchImageBufferForPdf(libraryLogoUrl) : Promise.resolve(null),
    branchLogoUrl ? fetchImageBufferForPdf(branchLogoUrl) : Promise.resolve(null),
  ]);

  const qrPayload = JSON.stringify({
    studentCode: student.studentId,
    name: student.fullName,
    library: library?.name,
    branch: branch?.branchName,
  });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 96 });
  const qrBuf = Buffer.from(qrDataUrl.split(',')[1] ?? '', 'base64');

  const doc = new PDFDocument({ size: [CARD_WIDTH, CARD_HEIGHT], margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  // Header band
  doc.save();
  doc.rect(0, 0, CARD_WIDTH, 44).fill('#1e3a8a');
  doc.fillColor('#ffffff').fontSize(11).text(library?.name ?? 'Study Library', MARGIN, 12, {
    width: CARD_WIDTH - MARGIN * 2 - 50,
    align: 'left',
  });
  doc.fontSize(7).fillColor('#cbd5e1').text(branch?.branchName ?? '', MARGIN, 28, {
    width: CARD_WIDTH - MARGIN * 2 - 50,
  });
  if (libraryLogoBuf) {
    try {
      doc.image(libraryLogoBuf, CARD_WIDTH - MARGIN - 32, 8, { width: 32, height: 28, fit: [32, 28] });
    } catch {
      /* skip */
    }
  }
  doc.restore();

  const photoX = MARGIN;
  const photoY = 52;
  const photoSize = 58;
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 4).lineWidth(1).stroke('#e2e8f0');
  if (photoBuf) {
    try {
      doc.image(photoBuf, photoX + 2, photoY + 2, { width: photoSize - 4, height: photoSize - 4, fit: [photoSize - 4, photoSize - 4] });
    } catch {
      doc.fontSize(8).fillColor('#94a3b8').text('No photo', photoX + 8, photoY + 24);
    }
  } else {
    doc.fontSize(8).fillColor('#94a3b8').text('No photo', photoX + 8, photoY + 24);
  }

  const textX = photoX + photoSize + 10;
  const textW = CARD_WIDTH - textX - MARGIN - 78;
  doc.fillColor('#0f172a').fontSize(12).text(student.fullName, textX, photoY, { width: textW });
  doc.fontSize(8).fillColor('#475569');
  let ty = photoY + 18;
  const line = (label: string, value: string) => {
    doc.text(`${label}: ${value}`, textX, ty, { width: textW });
    ty += 11;
  };
  line('ID', student.studentId);
  line('Phone', student.phone ?? '—');
  line('Branch', branch?.branchName ?? '—');
  line('Shift', shiftName);
  line('Seat', seat?.seatNumber != null ? String(seat.seatNumber) : '—');
  line('Valid from', fmtDate(student.membershipStartDate));
  line('Valid until', fmtDate(student.membershipEndDate));
  line('Emergency', student.emergencyContactPhone ?? student.guardianPhone ?? '—');

  if (branchLogoBuf) {
    try {
      doc.image(branchLogoBuf, textX + textW - 28, photoY, { width: 24, height: 24, fit: [24, 24] });
    } catch {
      /* skip */
    }
  }

  doc.image(qrBuf, CARD_WIDTH - MARGIN - 72, CARD_HEIGHT - MARGIN - 72, { width: 68, height: 68 });
  doc.fontSize(6).fillColor('#64748b').text(`Issued ${fmtDate(new Date())}`, MARGIN, CARD_HEIGHT - MARGIN - 8, {
    width: CARD_WIDTH - MARGIN * 2 - 80,
    align: 'left',
  });

  doc.end();
  return done;
}

/** Resolve student Mongo id for the logged-in student user. */
export async function resolveStudentIdForUser(userId: string): Promise<string> {
  const student = await StudentModel.findOne({ userId }).select('_id').lean();
  if (!student) throw ApiError.notFound('Student profile not found');
  return String(student._id);
}
