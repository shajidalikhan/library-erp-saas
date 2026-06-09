import type { CookieOptions, Response } from 'express';
import { ENV } from '@config/env.config';
import { COOKIE_NAMES } from '@constants/http.constants';

/**
 * Parses simple duration strings used by jsonwebtoken (e.g. "15m", "7d", "12h", "30s")
 * into milliseconds. Falls back to 0 on parse failure.
 */
const parseDurationToMs = (input: string): number => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(input.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'ms': return value;
    case 's':  return value * 1000;
    case 'm':  return value * 60 * 1000;
    case 'h':  return value * 60 * 60 * 1000;
    case 'd':  return value * 24 * 60 * 60 * 1000;
    default:   return 0;
  }
};

const baseCookieOptions = (): CookieOptions => {
  const opts: CookieOptions = {
    httpOnly: true,
    secure: ENV.COOKIE_SECURE,
    sameSite: ENV.COOKIE_SAME_SITE,
    path: '/',
  };
  const domain = ENV.COOKIE_DOMAIN?.trim();
  // Omit domain for localhost / empty — required for cross-origin API cookies (Vercel → Render).
  if (domain && domain !== 'localhost') {
    opts.domain = domain;
  }
  return opts;
};

export const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void => {
  const accessMaxAge = parseDurationToMs(ENV.JWT_ACCESS_EXPIRES_IN);
  const refreshMaxAge = parseDurationToMs(ENV.JWT_REFRESH_EXPIRES_IN);

  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
    ...baseCookieOptions(),
    maxAge: accessMaxAge,
  });

  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
    ...baseCookieOptions(),
    maxAge: refreshMaxAge,
    // Refresh token should only travel to the auth refresh route in stricter setups.
    // Keeping `/` for simplicity since SameSite + HttpOnly protect us here.
  });
};

export const clearAuthCookies = (res: Response): void => {
  const opts = baseCookieOptions();
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, opts);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, opts);
};
