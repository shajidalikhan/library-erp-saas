import { describe, expect, it } from 'vitest';

import { formatEntityLabel } from '@/lib/entity-label';

describe('formatEntityLabel', () => {
  it('formats student labels with name and code', () => {
    expect(
      formatEntityLabel({ fullName: 'Rohit Kumar', studentId: 'STU-001' }, 'student'),
    ).toBe('Rohit Kumar · STU-001');
  });

  it('formats branch labels with name and code', () => {
    expect(formatEntityLabel({ branchName: 'Main Branch', branchCode: 'BR-001' }, 'branch')).toBe(
      'Main Branch · BR-001',
    );
  });

  it('returns fallback labels when data is missing', () => {
    expect(formatEntityLabel(null, 'student')).toBe('Unknown student');
    expect(formatEntityLabel(null, 'branch')).toBe('Unknown branch');
  });
});
