import cron from 'node-cron';

import { ENV } from '@config/env.config';
import { logger } from '@utils/logger';

import { attendanceAutoCheckoutService } from './attendance-auto-checkout.service';

let sweepRunning = false;

async function runAutoCheckoutSweep(): Promise<void> {
  if (sweepRunning) {
    logger.warn('[attendance:cron] Auto-checkout sweep skipped — previous run still active');
    return;
  }
  sweepRunning = true;
  try {
    await attendanceAutoCheckoutService.runSweep();
  } catch (err) {
    logger.error('[attendance:cron] Auto-checkout sweep failed:', err);
  } finally {
    sweepRunning = false;
  }
}

export function registerAttendanceCronJobs(): void {
  if (!ENV.AUTO_CHECKOUT_ENABLED) {
    logger.info('[attendance:cron] Auto-checkout disabled (AUTO_CHECKOUT_ENABLED=false)');
    return;
  }

  cron.schedule('*/15 * * * *', () => {
    void runAutoCheckoutSweep();
  });

  logger.info('[attendance:cron] Registered auto-checkout job (every 15 minutes)');
}
