import { describe, expect, it } from 'vitest';

import { bulkCreateSeatsBodySchema, createSeatBodySchema } from './seat.validation';

const lib = '507f1f77bcf86cd799439011';
const branch = '507f1f77bcf86cd799439012';

describe('seat.validation', () => {
 it('parses create seat', () => {
    const v = createSeatBodySchema.parse({
      libraryId: lib,
      branchId: branch,
      seatNumber: 'A-01',
      floor: '2',
      zone: 'North',
    });
    expect(v.seatNumber).toBe('A-01');
  });

  it('rejects bulk when end < start', () => {
    expect(() =>
      bulkCreateSeatsBodySchema.parse({
        libraryId: lib,
        branchId: branch,
        startNumber: 10,
        endNumber: 2,
        floor: '1',
        zone: 'Z',
      }),
    ).toThrow();
  });
});
