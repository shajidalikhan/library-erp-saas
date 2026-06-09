import rateLimit from 'express-rate-limit';
import { ENV } from '@config/env.config';
import { HTTP_STATUS } from '@constants/http.constants';

/**
 * Global API limiter (applied to all routes).
 */
export const globalRateLimiter = rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  limit: ENV.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later.',
  },
});

/**
 * Stricter limiter for sensitive auth endpoints (login/register/refresh).
 */
export const authRateLimiter = rateLimit({
  windowMs: ENV.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: ENV.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  // Count failed requests more aggressively.
  skipSuccessfulRequests: false,
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    code: 'TOO_MANY_AUTH_REQUESTS',
    message: 'Too many authentication attempts, please try again later.',
  },
});

/**
 * Public booking pages / APIs limiter.
 */
export const publicRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    code: 'TOO_MANY_PUBLIC_REQUESTS',
    message: 'Too many public booking requests, please try again later.',
  },
});
