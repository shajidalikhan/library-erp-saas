import { describe, expect, it } from 'vitest';

import { STUDENT_STATUS } from './student.constants';
import {
  buildDashboardCountFilters,
  buildMembershipFilterClauses,
  getMembershipDateBounds,
} from './membership-query.util';

describe('membership-query.util', () => {
  const ref = new Date('2026-05-16T12:00:00.000Z');
  const bounds = getMembershipDateBounds(ref);

  it('ACTIVE filter requires end >= today start and ACTIVE status', () => {
    const clauses = buildMembershipFilterClauses({ membershipStatus: 'ACTIVE' }, bounds);
    expect(clauses).toEqual([
      {
        membershipEndDate: { $gte: bounds.todayStart },
        status: STUDENT_STATUS.ACTIVE,
      },
    ]);
  });

  it('SUSPENDED filter matches expired end or suspended status', () => {
    const clauses = buildMembershipFilterClauses({ membershipStatus: 'SUSPENDED' }, bounds);
    expect(clauses[0]).toEqual({
      $or: [
        { membershipEndDate: { $lt: bounds.todayStart } },
        { status: STUDENT_STATUS.SUSPENDED },
      ],
    });
  });

  it('expiringIn 1-3 uses tomorrow through day+3 end', () => {
    const clauses = buildMembershipFilterClauses({ expiringIn: '1-3' }, bounds);
    expect(clauses[0]).toEqual({
      membershipEndDate: { $gte: bounds.tomorrowStart, $lte: bounds.day3End },
      status: STUDENT_STATUS.ACTIVE,
    });
  });

  it('expiringIn 4-7 uses day+4 start through day+7 end', () => {
    const clauses = buildMembershipFilterClauses({ expiringIn: '4-7' }, bounds);
    expect(clauses[0]).toEqual({
      membershipEndDate: { $gte: bounds.day4Start, $lte: bounds.day7End },
      status: STUDENT_STATUS.ACTIVE,
    });
  });

  it('dashboard count filters align with list filters', () => {
    const tenant = { libraryId: 'lib' };
    const counts = buildDashboardCountFilters(tenant, bounds);
    expect(counts.active).toMatchObject({
      membershipEndDate: { $gte: bounds.todayStart },
      status: STUDENT_STATUS.ACTIVE,
    });
    expect(counts.expiring1to3).toMatchObject({
      membershipEndDate: { $gte: bounds.tomorrowStart, $lte: bounds.day3End },
    });
    const listActive = buildMembershipFilterClauses({ membershipStatus: 'ACTIVE' }, bounds);
    const listExpiring = buildMembershipFilterClauses({ expiringIn: '1-3' }, bounds);
    expect(counts.active).toMatchObject({ ...tenant, ...listActive[0] });
    expect(counts.expiring1to3).toMatchObject({ ...tenant, ...listExpiring[0] });
  });
});
