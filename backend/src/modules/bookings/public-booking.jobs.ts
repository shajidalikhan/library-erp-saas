import cron from 'node-cron';

import { logger } from '@utils/logger';

import { expirePublicSeatHolds } from './public-booking.service';

let registered = false;

export function registerPublicBookingCronJobs(): void {
  if (registered) return;
  registered = true;

  cron.schedule('*/15 * * * *', async () => {
    try {
      const released = await expirePublicSeatHolds();
      if (released > 0) {
        logger.info(`[bookings] Expired public holds released: ${released}`);
      }
    } catch (error) {
      logger.error('[bookings] Failed to expire public holds', error);
    }
  });
}
