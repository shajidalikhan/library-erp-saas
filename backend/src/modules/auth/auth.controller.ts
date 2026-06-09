import type { Request, Response } from 'express';

import { asyncHandler } from '@utils/asyncHandler';
import { ApiResponse } from '@utils/ApiResponse';
import { ApiError } from '@utils/ApiError';
import { setAuthCookies, clearAuthCookies } from '@utils/cookies';
import { COOKIE_NAMES } from '@constants/http.constants';

import { authService } from './auth.service';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  LogoutInput,
  ResetPasswordInput,
} from './auth.validation';

/**
 * Thin HTTP layer. Each handler:
 *  1. Pulls data off `req` (already validated by `validate` middleware).
 *  2. Delegates to `authService`.
 *  3. Translates the result into an HTTP response.
 *
 * No business logic lives here.
 */

const getDeviceMeta = (req: Request) => ({
  userAgent: req.headers['user-agent']?.toString(),
  ipAddress: req.ip,
});

import { AUTH_CONSTANTS } from './auth.constants';

class AuthController {
  login = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.validatedBody ?? req.body) as LoginInput;
    const { user, tokens } = await authService.login(
      body,
      getDeviceMeta(req),
    );
    setAuthCookies(res, tokens);
    return ApiResponse.ok(res, { user, tokens }, 'Login successful');
  });

  refresh = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.validatedBody ?? req.body) as { refreshToken?: string } | undefined;
    const fromCookie = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
    const fromBody = body?.refreshToken;
    const refreshToken = fromBody || fromCookie;

    if (!refreshToken) throw ApiError.unauthorized('Refresh token missing');

    const { user, tokens } = await authService.refresh(refreshToken, getDeviceMeta(req));
    setAuthCookies(res, tokens);
    return ApiResponse.ok(res, { user, tokens }, 'Token refreshed');
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.validatedBody ?? req.body) as LogoutInput | undefined;
    const { allDevices } = body || { allDevices: false };
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;

    if (req.user?.id) {
      await authService.logout(req.user.id, refreshToken, Boolean(allDevices));
    }

    clearAuthCookies(res);
    return ApiResponse.ok(res, null, allDevices ? 'Logged out from all devices' : 'Logged out');
  });

  me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const user = await authService.getCurrentUser(req.user.id);
    return ApiResponse.ok(res, { user }, 'Current user');
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.validatedBody ?? req.body) as ForgotPasswordInput;
    await authService.forgotPassword(body);
    return ApiResponse.ok(res, null, AUTH_CONSTANTS.FORGOT_PASSWORD_SUCCESS_MSG);
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const body = (req.validatedBody ?? req.body) as ResetPasswordInput;
    await authService.resetPassword(body);
    return ApiResponse.ok(res, null, AUTH_CONSTANTS.RESET_PASSWORD_SUCCESS_MSG);
  });

  changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    const body = (req.validatedBody ?? req.body) as ChangePasswordInput;
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] as string | undefined;
    await authService.changePassword(req.user.id, body, refreshToken);
    return ApiResponse.ok(res, null, 'Password changed successfully');
  });
}

export const authController = new AuthController();
