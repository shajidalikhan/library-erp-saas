import 'dotenv/config';
import http from 'node:http';

import { createApp } from './app';
import { ENV } from '@config/env.config';
import { connectDB, disconnectDB } from '@config/db';
import { logger } from '@utils/logger';

/**
 * Eager model registration.
 *
 * Importing the auth module's models barrel here at boot time guarantees
 * that every schema (Permission -> Role -> User) is registered with
 * Mongoose *before* the first request runs `.populate(...)`. Without this,
 * the first request can hit "Schema hasn't been registered for model X".
 *
 * Add new module model barrels to this list as the platform grows
 * (e.g. `import '@modules/students/student.models';`).
 */
import { __registeredModels } from '@modules/auth/auth.models';
import { __libraryRegisteredModels } from '@modules/library/library.models';
import { __studentsRegisteredModels } from '@modules/students/students.models';
import { __notificationsRegisteredModels } from '@modules/notifications/notifications.models';
import { registerNotificationCronJobs } from '@modules/notifications/notifications.jobs';
import { registerAttendanceCronJobs } from '@modules/attendance/attendance.jobs';
import { registerPublicBookingCronJobs } from '@modules/bookings';
import { registerMembershipCronJobs } from '@modules/membership/membership.jobs';

/**
 * Production-grade bootstrap with:
 *  - DB connect-then-listen ordering
 *  - Graceful shutdown on SIGINT / SIGTERM
 *  - Hardened crash handlers for uncaught errors
 */

const app = createApp();
const server = http.createServer(app);

let shuttingDown = false;

const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn(`Shutting down (${reason})...`);

  // Stop accepting new connections.
  server.close(async () => {
    try {
      await disconnectDB();
    } catch (err) {
      logger.error('Error during DB disconnect:', err);
    } finally {
      logger.info('Shutdown complete.');
      process.exit(exitCode);
    }
  });

  // Hard kill if it takes too long.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout.');
    process.exit(exitCode || 1);
  }, 10_000).unref();
};

const bootstrap = async (): Promise<void> => {
  try {
    await connectDB();

    logger.info(
      `Registered Mongoose models: ${[...__registeredModels, ...__libraryRegisteredModels, ...__studentsRegisteredModels, ...__notificationsRegisteredModels].join(', ')}`,
    );

    registerNotificationCronJobs();
    registerAttendanceCronJobs();
    registerPublicBookingCronJobs();
    registerMembershipCronJobs();

    server.listen(ENV.PORT, () => {
      logger.info(
        `\u{1F680} Server running in ${ENV.NODE_ENV} on http://localhost:${ENV.PORT}${ENV.API_PREFIX}`,
      );
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    await shutdown('startup-error', 1);
  }
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
  void shutdown('uncaughtException', 1);
});

void bootstrap();
