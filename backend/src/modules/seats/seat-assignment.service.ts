import { Types } from 'mongoose';

import type { AuthenticatedUser } from '@/types/express';
import { ApiError } from '@utils/ApiError';
import { StudentModel } from '@modules/students/students.models';
import { ShiftModel } from '@modules/shifts/shift.model';
import {
  SHIFT_ASSIGNMENT_STATUS,
  type ShiftAssignmentStatus,
} from '@modules/shifts/shift.constants';

import { SeatModel } from './seat.model';
import { SeatAssignmentModel } from './seat-assignment.model';
import type { ISeatDocument } from './seat.model';
import {
  assertSeatAssignmentAllowed,
  type ShiftTimingInput,
} from './seat-occupancy.conflicts';

const toJSON = <T>(doc: unknown): T => JSON.parse(JSON.stringify(doc)) as T;

const ACTIVE_STATUSES = [
  SHIFT_ASSIGNMENT_STATUS.ACTIVE,
  SHIFT_ASSIGNMENT_STATUS.RESERVED,
] as const;

export async function syncSeatOccupancyFlags(seat: ISeatDocument): Promise<void> {
  const activeCount = await SeatAssignmentModel.countDocuments({
    seatId: seat._id,
    status: { $in: [...ACTIVE_STATUSES] },
  });

  if (seat.status === 'MAINTENANCE' || seat.status === 'BLOCKED') {
    seat.occupied = activeCount > 0;
    await seat.save();
    return;
  }

  if (activeCount > 0) {
    seat.occupied = true;
    if (seat.status === 'AVAILABLE') seat.status = 'OCCUPIED';
  } else {
    seat.occupied = false;
    if (seat.status === 'OCCUPIED') seat.status = 'AVAILABLE';
    seat.assignedStudentId = null;
  }
  await seat.save();
}

export async function createSeatAssignment(input: {
  user: AuthenticatedUser;
  seat: ISeatDocument;
  studentId: Types.ObjectId;
  shiftId: Types.ObjectId;
  startDate: Date;
  endDate: Date | null;
  membershipId?: Types.ObjectId | null;
  status?: ShiftAssignmentStatus;
}): Promise<Record<string, unknown>> {
  const { user, seat, studentId, shiftId, startDate, endDate } = input;
  const status = input.status ?? SHIFT_ASSIGNMENT_STATUS.ACTIVE;

  const student = await StudentModel.findById(studentId);
  if (!student) throw ApiError.notFound('Student not found');

  if (student.membershipEndDate && new Date(student.membershipEndDate) < startDate) {
    throw ApiError.badRequest('Student membership has expired');
  }

  const shift = await ShiftModel.findById(shiftId).lean();
  if (!shift) throw ApiError.notFound('Shift not found');
  if (String(shift.branchId) !== String(seat.branchId)) {
    throw ApiError.badRequest('Shift does not belong to this branch');
  }

  if (!shift.active) throw ApiError.badRequest('Shift is not active');

  const shiftTiming: ShiftTimingInput = {
    _id: shift._id as Types.ObjectId,
    type: shift.type,
    startTime: shift.startTime,
    endTime: shift.endTime,
  };

  await assertSeatAssignmentAllowed(seat._id as Types.ObjectId, shiftTiming, {
    excludeStudentId: studentId,
  });

  await SeatAssignmentModel.updateMany(
    { studentId, shiftId, status: { $in: [...ACTIVE_STATUSES] } },
    { $set: { status: SHIFT_ASSIGNMENT_STATUS.CANCELLED } },
  );

  const doc = await SeatAssignmentModel.create({
    libraryId: seat.libraryId,
    branchId: seat.branchId,
    seatId: seat._id,
    studentId,
    shiftId,
    membershipId: input.membershipId ?? null,
    startDate,
    endDate,
    status,
    assignedBy: new Types.ObjectId(user.id),
  });

  seat.assignedStudentId = studentId;
  await syncSeatOccupancyFlags(seat);

  if (!student.assignedSeatId) {
    student.assignedSeatId = seat._id as Types.ObjectId;
    await student.save();
  }

  const populated = await SeatAssignmentModel.findById(doc._id)
    .populate('studentId', 'fullName studentId phone profilePhoto membershipEndDate')
    .populate('shiftId', 'name startTime endTime type color')
    .lean();

  return toJSON(populated);
}

export async function updateSeatAssignment(
  user: AuthenticatedUser,
  assignmentId: string,
  input: {
    studentId?: string;
    shiftId?: string;
    status?: ShiftAssignmentStatus;
    endDate?: Date | null;
    membershipId?: string | null;
  },
): Promise<Record<string, unknown>> {
  const assignment = await SeatAssignmentModel.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Seat assignment not found');

  const seat = await SeatModel.findById(assignment.seatId);
  if (!seat) throw ApiError.notFound('Seat not found');

  const nextShiftId = input.shiftId
    ? new Types.ObjectId(input.shiftId)
    : (assignment.shiftId as Types.ObjectId);

  const shift = await ShiftModel.findById(nextShiftId).lean();
  if (!shift) throw ApiError.notFound('Shift not found');

  const shiftTiming: ShiftTimingInput = {
    _id: shift._id as Types.ObjectId,
    type: shift.type,
    startTime: shift.startTime,
    endTime: shift.endTime,
  };

  if (input.shiftId || input.studentId) {
    await assertSeatAssignmentAllowed(
      seat._id as Types.ObjectId,
      shiftTiming,
      assignment._id as Types.ObjectId,
    );
  }

  if (input.studentId) {
    const student = await StudentModel.findById(input.studentId);
    if (!student) throw ApiError.notFound('Student not found');
    assignment.studentId = student._id as Types.ObjectId;
  }

  if (input.shiftId) assignment.shiftId = nextShiftId;
  if (input.status) assignment.status = input.status;
  if (input.endDate !== undefined) assignment.endDate = input.endDate;
  if (input.membershipId !== undefined) {
    assignment.membershipId = input.membershipId
      ? new Types.ObjectId(input.membershipId)
      : null;
  }

  await assignment.save();
  await syncSeatOccupancyFlags(seat);

  const populated = await SeatAssignmentModel.findById(assignment._id)
    .populate('studentId', 'fullName studentId phone profilePhoto membershipEndDate')
    .populate('shiftId', 'name startTime endTime type color')
    .lean();

  return toJSON(populated);
}

export async function cancelSeatAssignment(
  _user: AuthenticatedUser,
  assignmentId: string,
): Promise<Record<string, unknown>> {
  const assignment = await SeatAssignmentModel.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Seat assignment not found');

  assignment.status = SHIFT_ASSIGNMENT_STATUS.CANCELLED;
  await assignment.save();

  const seat = await SeatModel.findById(assignment.seatId);
  if (seat) await syncSeatOccupancyFlags(seat);

  const student = await StudentModel.findById(assignment.studentId);
  if (student && String(student.assignedSeatId) === String(assignment.seatId)) {
    const other = await SeatAssignmentModel.exists({
      studentId: student._id,
      status: { $in: [...ACTIVE_STATUSES] },
    });
    if (!other) {
      student.assignedSeatId = null;
      await student.save();
    }
  }

  return toJSON(assignment.toObject());
}

export async function cancelAllSeatAssignments(seatId: Types.ObjectId): Promise<void> {
  await SeatAssignmentModel.updateMany(
    { seatId, status: { $in: [...ACTIVE_STATUSES] } },
    { $set: { status: SHIFT_ASSIGNMENT_STATUS.CANCELLED } },
  );
}

export async function enrichSeatsWithShiftAssignments(
  seats: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  if (!seats.length) return seats;
  const seatIds = seats
    .map((s) => s._id)
    .filter(Boolean)
    .map((id) => new Types.ObjectId(String(id)));
  const assignments = await SeatAssignmentModel.find({
    seatId: { $in: seatIds },
    status: { $in: [...ACTIVE_STATUSES] },
  })
    .populate('studentId', 'fullName studentId profilePhoto phone membershipEndDate')
    .populate('shiftId', 'name startTime endTime type color')
    .lean();

  const bySeat = new Map<string, Record<string, unknown>[]>();
  for (const a of assignments) {
    const key = String(a.seatId);
    if (!bySeat.has(key)) bySeat.set(key, []);
    bySeat.get(key)!.push(a as unknown as Record<string, unknown>);
  }

  return seats.map((seat) => ({
    ...seat,
    shiftAssignments: bySeat.get(String(seat._id)) ?? [],
  }));
}
