import { Types } from 'mongoose';

import { logActivity } from '@modules/activity/activity-audit.service';
import {
  seatService,
  type ReleaseStudentSeatsOptions,
  type ReleasedSeatInfo,
} from '@modules/seats/seat.service';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';

import { StudentModel } from './students.models';

export function logStudentSeatReleasedEvents(input: {
  actorUserId: string | null;
  student: {
    _id: Types.ObjectId;
    fullName: string;
    studentId: string;
    libraryId: Types.ObjectId;
    branchId: Types.ObjectId;
  };
  released: ReleasedSeatInfo[];
  reason: string;
}): void {
  for (const seat of input.released) {
    logActivity({
      actorUserId: input.actorUserId,
      action: 'STUDENT_SEAT_RELEASED',
      entityType: 'STUDENT',
      entityId: String(input.student._id),
      libraryId: String(input.student.libraryId),
      branchId: String(input.student.branchId),
      metadata: {
        studentName: input.student.fullName,
        studentCode: input.student.studentId,
        seatNumber: seat.seatNumber,
        shiftId: seat.shiftId,
        shiftName: seat.shiftName,
        reason: input.reason,
        entityLabel: input.student.fullName,
        description: `Seat ${seat.seatNumber} released — ${input.reason}`,
      },
    });
  }
}

export async function releaseStudentSeatsWithAudit(input: {
  studentId: string;
  reason: string;
  actorUserId?: string | null;
  releaseOptions?: ReleaseStudentSeatsOptions;
}): Promise<ReleasedSeatInfo[]> {
  const student = await StudentModel.findById(input.studentId).select(
    'fullName studentId libraryId branchId assignedSeatId',
  );
  if (!student) return [];

  const released = await seatService.releaseAllSeatsForStudent(input.studentId, {
    reason: input.reason,
    ...input.releaseOptions,
  });

  if (released.length) {
    logStudentSeatReleasedEvents({
      actorUserId: input.actorUserId ?? null,
      student,
      released,
      reason: input.reason,
    });
  }

  return released;
}

export const INACTIVE_RELEASE_REASON = 'Student marked inactive';
export const DELETED_RELEASE_REASON = 'Student deleted';
export const MEMBERSHIP_EXPIRED_RELEASE_REASON = 'Membership expired';

export const membershipExpiredReleaseOptions: ReleaseStudentSeatsOptions = {
  reason: MEMBERSHIP_EXPIRED_RELEASE_REASON,
  assignmentStatus: SHIFT_ASSIGNMENT_STATUS.EXPIRED,
};
