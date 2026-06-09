import type { CorsOptions } from 'cors';

import { ENV } from '@config/env.config';
import { logger } from '@utils/logger';

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
] as const;

/**
 * CORS for SPA clients (Vercel) calling API on another origin (Render).
 *
 * - `CORS_RELAXED=true` reflects any request Origin (debug / temporary).
 * - Otherwise only origins in `CORS_ORIGINS` are allowed (comma-separated).
 * - `credentials: true` requires a reflected origin, never `*`.
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (ENV.CORS_RELAXED) {
      return callback(null, true);
    }

    if (
      ENV.CORS_ORIGINS_LIST.includes(origin) ||
      ENV.CORS_ORIGINS_LIST.includes('*')
    ) {
      return callback(null, origin);
    }

    logger.warn(`CORS rejected origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: [...ALLOWED_METHODS],
  allowedHeaders: [...ALLOWED_HEADERS],
  exposedHeaders: ['Content-Disposition', 'Content-Type'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

/** Temporary debug profile: reflect any browser origin on preflight + actual requests. */
export const corsDebugOptions: CorsOptions = {
  origin: true,
  credentials: true,
  methods: [...ALLOWED_METHODS],
  allowedHeaders: [...ALLOWED_HEADERS],
  exposedHeaders: ['Content-Disposition', 'Content-Type'],
  optionsSuccessStatus: 204,
  preflightContinue: false,
};

export const activeCorsOptions = (): CorsOptions =>
  ENV.CORS_RELAXED ? corsDebugOptions : corsOptions;
