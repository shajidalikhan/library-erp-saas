import { describe, expect, it } from 'vitest';

import { ApiError } from '@utils/ApiError';

import { signAttendanceQrToken, verifyAttendanceQrToken } from './attendance-qr-token';

describe('attendance-qr-token', () => {
  it('round-trips signed claims', () => {
    const { token, expiresAt } = signAttendanceQrToken({
      sid: '507f1f77bcf86cd799439011',
      lid: '507f1f77bcf86cd799439012',
      bid: '507f1f77bcf86cd799439013',
    });
    expect(token.length).toBeGreaterThan(40);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());

    const claims = verifyAttendanceQrToken(token);
    expect(claims.sid).toBe('507f1f77bcf86cd799439011');
    expect(claims.lid).toBe('507f1f77bcf86cd799439012');
    expect(claims.bid).toBe('507f1f77bcf86cd799439013');
  });

  it('rejects garbage as invalid QR', () => {
    expect(() => verifyAttendanceQrToken('not-a-valid-jwt')).toThrow(ApiError);
  });
});
