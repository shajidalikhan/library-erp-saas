import { STUDENT_STATUS } from './student.constants';

export type MembershipStatusFilter = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
export type ExpiringInFilter = '1-3' | '4-7';

export interface MembershipDateBounds {
  todayStart: Date;
  todayEnd: Date;
  tomorrowStart: Date;
  day3End: Date;
  day4Start: Date;
  day7End: Date;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addCalendarDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** Shared calendar boundaries for dashboard counts and list filters. */
export function getMembershipDateBounds(ref = new Date()): MembershipDateBounds {
  const todayStart = startOfDay(ref);
  const todayEnd = endOfDay(ref);
  return {
    todayStart,
    todayEnd,
    tomorrowStart: startOfDay(addCalendarDays(ref, 1)),
    day3End: endOfDay(addCalendarDays(ref, 3)),
    day4Start: startOfDay(addCalendarDays(ref, 4)),
    day7End: endOfDay(addCalendarDays(ref, 7)),
  };
}

export interface MembershipListFilterInput {
  membershipStatus?: MembershipStatusFilter;
  expiringIn?: ExpiringInFilter;
  membershipEndFrom?: Date;
  membershipEndTo?: Date;
  /** @deprecated use membershipStatus / expiringIn */
  membershipFilter?: string;
  membershipExpired?: boolean;
}

/**
 * Builds $and clauses for student list / dashboard counts.
 * ACTIVE: end >= start of today and status ACTIVE.
 * SUSPENDED/EXPIRED card: end < start of today OR status SUSPENDED.
 * expiringIn 1-3: end between tomorrow and end of today+3, status ACTIVE.
 * expiringIn 4-7: end between start of today+4 and end of today+7, status ACTIVE.
 */
export function buildMembershipFilterClauses(
  input: MembershipListFilterInput,
  bounds = getMembershipDateBounds(),
): Record<string, unknown>[] {
  const clauses: Record<string, unknown>[] = [];

  if (input.membershipStatus === 'ACTIVE') {
    clauses.push({
      membershipEndDate: { $gte: bounds.todayStart },
      status: STUDENT_STATUS.ACTIVE,
    });
  } else if (
    input.membershipStatus === 'SUSPENDED' ||
    input.membershipStatus === 'EXPIRED'
  ) {
    clauses.push({
      $or: [
        { membershipEndDate: { $lt: bounds.todayStart } },
        { status: STUDENT_STATUS.SUSPENDED },
      ],
    });
  }

  if (input.expiringIn === '1-3') {
    clauses.push({
      membershipEndDate: { $gte: bounds.tomorrowStart, $lte: bounds.day3End },
      status: STUDENT_STATUS.ACTIVE,
    });
  } else if (input.expiringIn === '4-7') {
    clauses.push({
      membershipEndDate: { $gte: bounds.day4Start, $lte: bounds.day7End },
      status: STUDENT_STATUS.ACTIVE,
    });
  }

  if (input.membershipEndFrom) {
    clauses.push({ membershipEndDate: { $gte: input.membershipEndFrom } });
  }
  if (input.membershipEndTo) {
    clauses.push({ membershipEndDate: { $lte: input.membershipEndTo } });
  }

  // Legacy query params
  if (!input.membershipStatus && !input.expiringIn) {
    if (input.membershipFilter === 'active') {
      clauses.push({
        membershipEndDate: { $gte: bounds.todayStart },
        status: STUDENT_STATUS.ACTIVE,
      });
    } else if (input.membershipFilter === 'expired') {
      clauses.push({
        $or: [
          { membershipEndDate: { $lt: bounds.todayStart } },
          { status: STUDENT_STATUS.SUSPENDED },
        ],
      });
    } else if (input.membershipFilter === 'expiring1to3') {
      clauses.push({
        membershipEndDate: { $gte: bounds.tomorrowStart, $lte: bounds.day3End },
        status: STUDENT_STATUS.ACTIVE,
      });
    } else if (input.membershipFilter === 'expiring4to7') {
      clauses.push({
        membershipEndDate: { $gte: bounds.day4Start, $lte: bounds.day7End },
        status: STUDENT_STATUS.ACTIVE,
      });
    } else if (input.membershipFilter === 'expiredToday') {
      clauses.push({
        membershipEndDate: { $gte: bounds.todayStart, $lte: bounds.todayEnd },
      });
    } else if (input.membershipExpired === true) {
      clauses.push({ membershipEndDate: { $lt: bounds.todayStart } });
    } else if (input.membershipExpired === false) {
      clauses.push({
        $or: [{ membershipEndDate: null }, { membershipEndDate: { $gte: bounds.todayStart } }],
      });
    }
  }

  return clauses;
}

export function buildDashboardCountFilters(
  tenantFilter: Record<string, unknown>,
  bounds = getMembershipDateBounds(),
): {
  active: Record<string, unknown>;
  expiredSuspended: Record<string, unknown>;
  expiring1to3: Record<string, unknown>;
  expiring4to7: Record<string, unknown>;
} {
  return {
    active: {
      ...tenantFilter,
      membershipEndDate: { $gte: bounds.todayStart },
      status: STUDENT_STATUS.ACTIVE,
    },
    expiredSuspended: {
      ...tenantFilter,
      $or: [
        { membershipEndDate: { $lt: bounds.todayStart } },
        { status: STUDENT_STATUS.SUSPENDED },
      ],
    },
    expiring1to3: {
      ...tenantFilter,
      membershipEndDate: { $gte: bounds.tomorrowStart, $lte: bounds.day3End },
      status: STUDENT_STATUS.ACTIVE,
    },
    expiring4to7: {
      ...tenantFilter,
      membershipEndDate: { $gte: bounds.day4Start, $lte: bounds.day7End },
      status: STUDENT_STATUS.ACTIVE,
    },
  };
}
