import cron from 'node-cron';

import { logger } from '@utils/logger';

import { processPendingMembershipDowngrades } from './membership-partial.service';

export function registerMembershipCronJobs(): void {
  cron.schedule('0 */6 * * *', async () => {
    try {
      const count = await processPendingMembershipDowngrades();
      if (count > 0) {
        logger.info(`Membership downgrade job: processed ${count} downgrade(s)`);
      }
    } catch (err) {
      logger.error('Membership downgrade cron failed', err);
    }
  });
}
