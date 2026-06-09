import jwt, { type SignOptions, type VerifyOptions, type JwtPayload } from 'jsonwebtoken';
import { ENV } from './env.config';
import type { RoleName } from '@constants/roles.constants';

/**
 * JWT helpers.
 * - Access + refresh tokens are signed with **separate secrets**.
 * - Payload is intentionally small (id + tenant + role); permissions are
 *   resolved per-request from the DB (so revocations apply instantly).
 */

export interface JwtUserPayload extends JwtPayload {
  sub: string;
  role: RoleName;
  libraryId?: string | null;
  branchId?: string | null;
  tokenType: 'access' | 'refresh';
}

const signOptions = (expiresIn: SignOptions['expiresIn']): SignOptions => ({
  issuer: ENV.JWT_ISSUER,
  audience: ENV.JWT_AUDIENCE,
  expiresIn,
});

const verifyOptions = (): VerifyOptions => ({
  issuer: ENV.JWT_ISSUER,
  audience: ENV.JWT_AUDIENCE,
});

type SignablePayload = Omit<JwtUserPayload, 'tokenType' | 'iat' | 'exp' | 'iss' | 'aud'>;

export const signAccessToken = (payload: SignablePayload): string =>
  jwt.sign(
    { ...payload, tokenType: 'access' },
    ENV.JWT_ACCESS_SECRET,
    signOptions(ENV.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn']),
  );

export const signRefreshToken = (payload: SignablePayload): string =>
  jwt.sign(
    { ...payload, tokenType: 'refresh' },
    ENV.JWT_REFRESH_SECRET,
    signOptions(ENV.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn']),
  );

export const verifyAccessToken = (token: string): JwtUserPayload =>
  jwt.verify(token, ENV.JWT_ACCESS_SECRET, verifyOptions()) as unknown as JwtUserPayload;

export const verifyRefreshToken = (token: string): JwtUserPayload =>
  jwt.verify(token, ENV.JWT_REFRESH_SECRET, verifyOptions()) as unknown as JwtUserPayload;
