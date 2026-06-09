/**
 * Migrate legacy seat.shiftType + assignedStudentId → SeatAssignment rows.
 *
 * Run: npm run migrate:seat-shifts
 * Dry run: npm run migrate:seat-shifts -- --dry-run
 */

import 'dotenv/config';
import { Types } from 'mongoose';

import { connectDB, disconnectDB } from '@config/db';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';
import {
  createSeatAssignment,
  syncSeatOccupancyFlags,
} from '@modules/seats/seat-assignment.service';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { resolveShiftIdForLegacySeat } from '@modules/seats/seat-shift-migration.util';
import { SeatModel } from '@modules/seats/seat.model';
import { StudentModel } from '@modules/students/students.models';

const dryRun = process.argv.includes('--dry-run');

const run = async (): Promise<void> => {
  const log = (msg: string) => console.log(`[migrate-seat-shifts] ${msg}`);

  await connectDB();

  const seats = await SeatModel.find({ assignedStudentId: { $ne: null } })
    .select('+shiftType seatNumber branchId libraryId assignedStudentId')
    .lean();

  log(`Found ${seats.length} seats with legacy assignedStudentId`);

  let created = 0;
  let skipped = 0;

  for (const seat of seats) {
    const studentId = seat.assignedStudentId as Types.ObjectId;
    const exists = await SeatAssignmentModel.exists({
      seatId: seat._id,
      studentId,
      status: { $in: [SHIFT_ASSIGNMENT_STATUS.ACTIVE, SHIFT_ASSIGNMENT_STATUS.RESERVED] },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    const shiftId = await resolveShiftIdForLegacySeat({
      _id: seat._id as Types.ObjectId,
      branchId: seat.branchId as Types.ObjectId,
      libraryId: seat.libraryId as Types.ObjectId,
    });

    if (!shiftId) {
      log(`SKIP ${seat.seatNumber}: no matching shift for legacy type ${seat.shiftType ?? 'none'}`);
      skipped += 1;
      continue;
    }

    const student = await StudentModel.findById(studentId).lean();
    if (!student) {
      log(`SKIP ${seat.seatNumber}: student ${studentId} missing`);
      skipped += 1;
      continue;
    }

    if (dryRun) {
      log(`DRY RUN would assign ${seat.seatNumber} → ${student.fullName} shift ${shiftId}`);
      created += 1;
      continue;
    }

    const seatDoc = await SeatModel.findById(seat._id);
    if (!seatDoc) continue;

    const startDate = student.membershipStartDate
      ? new Date(student.membershipStartDate)
      : new Date();
    const endDate = student.membershipEndDate ? new Date(student.membershipEndDate) : null;

    await createSeatAssignment({
      user: { id: String(student._id), role: 'LIBRARY_OWNER', permissions: [] } as never,
      seat: seatDoc,
      studentId,
      shiftId,
      startDate,
      endDate,
    });

    if (!student.assignedSeatId) {
      await StudentModel.updateOne({ _id: studentId }, { $set: { assignedSeatId: seat._id } });
    }

    await syncSeatOccupancyFlags(seatDoc);
    created += 1;
    log(`Migrated ${seat.seatNumber} → ${student.fullName}`);
  }

  log(`Done. created=${created} skipped=${skipped} dryRun=${dryRun}`);
  await disconnectDB();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
