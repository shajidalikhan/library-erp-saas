import { describe, expect, it } from 'vitest';

import {
  assignSeatSchema,
  createStudentSchema,
  listStudentsQuerySchema,
  transferStudentSchema,
} from './student.validation';

describe('student.validation', () => {
  it('parses list query with membership flags', () => {
    const q = listStudentsQuerySchema.parse({
      page: '1',
      membershipExpired: 'true',
    });
    expect(q.membershipExpired).toBe(true);
  });

  it('requires branchId on create', () => {
    expect(() =>
      createStudentSchema.parse({
        fullName: 'A',
        email: 'a@b.com',
      }),
    ).toThrow();
  });

  it('accepts create payload with branch', () => {
    const b = createStudentSchema.parse({
      branchId: '507f1f77bcf86cd799439011',
      fullName: 'Rohit Kumar',
      email: 'rohit@example.com',
    });
    expect(b.branchId).toBe('507f1f77bcf86cd799439011');
  });

  it('parses transfer body', () => {
    const t = transferStudentSchema.parse({
      branchId: '507f1f77bcf86cd799439012',
    });
    expect(t.branchId).toHaveLength(24);
  });

  it('allows null assignedSeatId', () => {
    const s = assignSeatSchema.parse({ assignedSeatId: null });
    expect(s.assignedSeatId).toBeNull();
  });
});
