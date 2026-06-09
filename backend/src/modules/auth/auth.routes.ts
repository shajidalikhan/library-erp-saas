import { Router } from 'express';

import { validate } from '@middlewares/validate.middleware';
import { authenticate } from '@middlewares/auth.middleware';
import { authRateLimiter } from '@middlewares/rateLimit.middleware';

import { authController } from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  resetPasswordSchema,
} from './auth.validation';

/**
 * Auth routes - mounted at `${API_PREFIX}/auth` by app.ts.
 *
 * - `authRateLimiter` is applied to sensitive endpoints (login, refresh).
 * - `authenticate` is applied to endpoints that require a logged-in user.
 *
 * Public self-registration is disabled; users are provisioned via `/users`.
 */
const router = Router();

router.post(
  '/login',
  authRateLimiter,
  validate({ body: loginSchema }),
  authController.login,
);

router.post(
  '/forgot-password',
  authRateLimiter,
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword,
);

router.post(
  '/reset-password',
  authRateLimiter,
  validate({ body: resetPasswordSchema }),
  authController.resetPassword,
);

router.post(
  '/refresh',
  authRateLimiter,
  validate({ body: refreshSchema }),
  authController.refresh,
);

router.post(
  '/logout',
  authenticate,
  validate({ body: logoutSchema }),
  authController.logout,
);

router.get('/me', authenticate, authController.me);

router.post(
  '/change-password',
  authenticate,
  authRateLimiter,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);

export { router as authRoutes };
