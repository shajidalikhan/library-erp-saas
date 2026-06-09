import { Router } from 'express';

import { authenticate } from '@middlewares/auth.middleware';
import { authRateLimiter } from '@middlewares/rateLimit.middleware';
import { validate } from '@middlewares/validate.middleware';

import { settingsController } from './settings.controller';
import {
  patchEmailTemplateSchema,
  patchNotificationPreferencesSchema,
  patchProfileSchema,
  previewEmailTemplateSchema,
  testEmailSchema,
} from './settings.validation';

const router = Router();

router.use(authenticate);

router.get('/profile', settingsController.getProfile);
router.patch('/profile', validate({ body: patchProfileSchema }), settingsController.patchProfile);

router.get('/notifications', settingsController.getNotificationPreferences);
router.patch(
  '/notifications',
  validate({ body: patchNotificationPreferencesSchema }),
  settingsController.patchNotificationPreferences,
);

router.get('/email', settingsController.getEmailSettings);
router.post(
  '/email/test',
  authRateLimiter,
  validate({ body: testEmailSchema }),
  settingsController.sendTestEmail,
);

router.get('/email-templates', settingsController.listEmailTemplates);
router.post('/email-templates/seed-defaults', settingsController.seedEmailTemplates);
router.get('/email-templates/:key', settingsController.getEmailTemplate);
router.patch(
  '/email-templates/:key',
  validate({ body: patchEmailTemplateSchema }),
  settingsController.patchEmailTemplate,
);
router.post('/email-templates/:key/reset', settingsController.resetEmailTemplate);
router.post(
  '/email-templates/:key/preview',
  validate({ body: previewEmailTemplateSchema }),
  settingsController.previewEmailTemplate,
);

export { router as settingsRoutes };
