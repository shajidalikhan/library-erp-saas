import crypto from 'node:crypto';

import jwt, { type JwtPayload, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

import { ENV } from '@config/env.config';
import { ApiError } from '@utils/ApiError';

const QR_ISSUER = 'library-erp';
const QR_AUDIENCE = 'library-erp-attendance-qr-v1';
/** Short-lived gate pass; student app shows countdown. */
const QR_EXPIRES_IN = '10m';

function qrSigningSecret(): string {
  return crypto.createHmac('sha256', ENV.JWT_ACCESS_SECRET).update(QR_AUDIENCE).digest('hex');
}

export type AttendanceQrClaims = {
  typ: 'attendance_qr';
  sid: string;
  lid: string;
  bid: string;
};

export function signAttendanceQrToken(payload: {
  sid: string;
  lid: string;
  bid: string;
}): { token: string; expiresAt: string } {
  const secret = qrSigningSecret();
  const token = jwt.sign(
    { typ: 'attendance_qr' as const, sid: payload.sid, lid: payload.lid, bid: payload.bid },
    secret,
    { expiresIn: QR_EXPIRES_IN, issuer: QR_ISSUER, audience: QR_AUDIENCE },
  );
  const decoded = jwt.decode(token) as JwtPayload | null;
  const exp = decoded?.exp;
  return {
    token,
    expiresAt: exp ? new Date(exp * 1000).toISOString() : new Date().toISOString(),
  };
}

export function verifyAttendanceQrToken(token: string): AttendanceQrClaims {
  try {
    const secret = qrSigningSecret();
    const decoded = jwt.verify(token.trim(), secret, {
      issuer: QR_ISSUER,
      audience: QR_AUDIENCE,
    }) as JwtPayload;

    if (
      decoded.typ !== 'attendance_qr' ||
      typeof decoded.sid !== 'string' ||
      typeof decoded.lid !== 'string' ||
      typeof decoded.bid !== 'string'
    ) {
      throw ApiError.badRequest('Invalid QR code');
    }

    return {
      typ: 'attendance_qr',
      sid: decoded.sid,
      lid: decoded.lid,
      bid: decoded.bid,
    };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof TokenExpiredError) {
      throw ApiError.unauthorized(
        'This QR code has expired. Ask the student to refresh their code.',
      );
    }
    if (e instanceof JsonWebTokenError) {
      throw ApiError.badRequest('Invalid QR code');
    }
    throw e;
  }
}
