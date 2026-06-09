import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import compression from 'compression';

import { activeCorsOptions } from '@config/cors.config';
import { ENV } from '@config/env.config';
import { logger } from '@utils/logger';
import { ApiResponse } from '@utils/ApiResponse';
import {
  errorHandler,
  notFoundHandler,
  globalRateLimiter,
  requestIdMiddleware,
} from '@middlewares/index';
import { apiRouter } from './routes';

/**
 * Express application factory.
 * Keeping app + server separate makes testing and graceful shutdown easier.
 */
export const createApp = (): Application => {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // --------- Core middleware ---------
  app.use(requestIdMiddleware);
  app.use(helmet());

  // Handles preflight (OPTIONS) and actual cross-origin requests for all paths.
  // Do not use app.options('*', ...) — Express 5 / path-to-regexp rejects bare '*'.
  app.use(cors(activeCorsOptions()));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  app.use(compression());

  if (!ENV.IS_TEST) {
    app.use(
      morgan(ENV.IS_PROD ? 'combined' : 'dev', {
        stream: { write: (msg) => logger.http(msg.trim()) },
      }),
    );
  }

  // --------- Health endpoints ---------
  app.get('/health', (_req: Request, res: Response) =>
    ApiResponse.ok(res, { status: 'ok', uptime: process.uptime() }, 'Service healthy'),
  );

  app.get(`${ENV.API_PREFIX}/health`, (_req, res) =>
    ApiResponse.ok(res, { status: 'ok', uptime: process.uptime() }, 'API healthy'),
  );

  // --------- Global rate limit (skips health endpoints above) ---------
  app.use(ENV.API_PREFIX, globalRateLimiter);

  // --------- API routes ---------
  app.use(ENV.API_PREFIX, apiRouter);

  // --------- 404 + error handler (must be last) ---------
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
