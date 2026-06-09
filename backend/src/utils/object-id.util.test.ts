import { describe, expect, it } from 'vitest';

import { ApiError } from '@utils/ApiError';
import { requireObjectId } from '@utils/object-id.util';

describe('requireObjectId', () => {
  it('rejects empty and invalid values', () => {
    expect(() => requireObjectId('', 'studentId')).toThrow(ApiError);
    expect(() => requireObjectId('all', 'branchId')).toThrow(ApiError);
    expect(() => requireObjectId('not-valid', 'libraryId')).toThrow(ApiError);
  });

  it('accepts valid hex id', () => {
    const id = requireObjectId('507f1f77bcf86cd799439011', 'studentId');
    expect(String(id)).toBe('507f1f77bcf86cd799439011');
  });
});
