import { Types } from 'mongoose';

import { ENV } from '@config/env.config';
import { logger } from '@utils/logger';
import { logActivity } from '@modules/activity/activity-audit.service';
import { SeatAssignmentModel } from '@modules/seats/seat-assignment.model';
import { ShiftModel } from '@modules/shifts/shift.model';
import { SHIFT_ASSIGNMENT_STATUS } from '@modules/shifts/shift.constants';
import { LibraryModel } from '@modules/library/library.models';

import { AttendanceModel } from './attendance.models';
import type { CheckOutSource } from './attendance.constants';
import { shouldAutoCheckoutSession } from './attendance-shift.util';
import { __attendanceTestables } from './attendance.service';

const { calcDurationMinutes, classifyOnCheckout, dateKeyInTimezone } = __attendanceTestables;

const AUTO_CHECKOUT_NOTE = 'Auto checkout at shift/library closing time';

type ActiveSessionRow = {
  _id: Types.ObjectId;
  libraryId: Types.ObjectId;
  branchId: Types.ObjectId;
  studentId: Types.ObjectId;
  checkInAt: Date;
  date: Date;
};

async function getLibraryTimezone(libraryId: string): Promise<string> {
  const library = await LibraryModel.findById(libraryId).select('timezone').lean();
  return library?.timezone || 'Asia/Kolkata';
}

async function resolveShiftForStudent(
  studentId: Types.ObjectId,
  branchId: Types.ObjectId,
): Promise<{ startTime: string; endTime: string } | null> {
  const assignment = await SeatAssignmentModel.findOne({
    studentId,
    branchId,
    status: SHIFT_ASSIGNMENT_STATUS.ACTIVE,
  })
    .populate('shiftId', 'startTime endTime active')
    .lean();

  const shift = assignment?.shiftId as
    | { startTime?: string; endTime?: string; active?: boolean }
    | null
    | undefined;

  if (!shift?.startTime || !shift?.endTime || shift.active === false) return null;
  return { startTime: shift.startTime, endTime: shift.endTime };
}

async function autoCheckoutOne(
  session: ActiveSessionRow,
  checkOutAt: Date,
): Promise<boolean> {
  const updated = await AttendanceModel.findOneAndUpdate(
    {
      _id: session._id,
      checkOutAt: null,
      checkInAt: { $ne: null },
    },
    {
      $set: {
        checkOutAt,
        checkOutSource: 'SYSTEM_AUTO' satisfies CheckOutSource,
        notes: AUTO_CHECKOUT_NOTE,
        durationMinutes: calcDurationMinutes(session.checkInAt, checkOutAt),
        status: classifyOnCheckout(session.checkInAt, checkOutAt),
        updatedBy: null,
      },
    },
    { new: true },
  ).lean();

  if (!updated) return false;

  const shift = await resolveShiftForStudent(session.studentId, session.branchId);

  logActivity({
    actorUserId: null,
    action: 'ATTENDANCE_AUTO_CHECKOUT',
    entityType: 'STUDENT',
    entityId: String(session.studentId),
    libraryId: String(session.libraryId),
    branchId: String(session.branchId),
    metadata: {
      attendanceId: String(session._id),
      checkInAt: session.checkInAt.toISOString(),
      autoCheckOutAt: checkOutAt.toISOString(),
      shiftName: shift ? `${shift.startTime}-${shift.endTime}` : null,
      description: 'System auto checkout at shift/library closing time',
    },
  });

  return true;
}

class AttendanceAutoCheckoutService {
  async runSweep(now: Date = new Date()): Promise<{ processed: number; closed: number }> {
    if (!ENV.AUTO_CHECKOUT_ENABLED) {
      return { processed: 0, closed: 0 };
    }

    const graceMinutes = ENV.AUTO_CHECKOUT_GRACE_MINUTES;
    const activeSessions = await AttendanceModel.find({
      checkOutAt: null,
      checkInAt: { $ne: null },
    })
      .select('_id libraryId branchId studentId checkInAt date')
      .lean();

    let closed = 0;
    for (const raw of activeSessions) {
      const session = raw as ActiveSessionRow;
      if (!session.checkInAt) continue;

      const tz = await getLibraryTimezone(String(session.libraryId));
      const sessionDateKey = dateKeyInTimezone(session.checkInAt, tz);
      const shift = await resolveShiftForStudent(session.studentId, session.branchId);

      if (
        !shouldAutoCheckoutSession({
          checkInAt: session.checkInAt,
          sessionDateKey,
          shift,
          graceMinutes,
          now,
        })
      ) {
        continue;
      }

      const didClose = await autoCheckoutOne(session, now);
      if (didClose) closed += 1;
    }

    if (closed > 0) {
      logger.info('[attendance:auto-checkout] Closed expired sessions', {
        processed: activeSessions.length,
        closed,
      });
    }

    return { processed: activeSessions.length, closed };
  }
}

export const attendanceAutoCheckoutService = new AttendanceAutoCheckoutService();

export const __attendanceAutoCheckoutTestables = {
  shouldAutoCheckoutSession,
  AUTO_CHECKOUT_NOTE,
};
