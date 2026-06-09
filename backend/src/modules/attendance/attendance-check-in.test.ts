import { describe, expect, it } from 'vitest';

import { ApiError } from '@utils/ApiError';
import { requireObjectId } from '@utils/object-id.util';

describe('attendance check-in guards', () => {
  it('rejects invalid studentId before Mongo', () => {
    expect(() => requireObjectId('', 'studentId')).toThrow(ApiError);
    expect(() => requireObjectId('not-an-id', 'studentId')).toThrow(ApiError);
  });
});
