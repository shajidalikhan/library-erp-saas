import { request } from '@/lib/axios';
import { clearSessionCookies, syncSessionCookies } from '@/lib/session-cookies';
import { tokenStorage } from '@/lib/token-storage';
import type {
  AuthSession,
  AuthUser,
  LoginCredentials,
} from '@/types/auth';

/**
 * Auth API client - one thin function per backend endpoint.
 * Returns the unwrapped `data` payload from the ApiResponse envelope.
 *
 * Side effects:
 *   - On login: persist tokens to localStorage + first-party session cookies
 *     (middleware on Vercel; Render API cookies are on a different host).
 *   - On logout: clear localStorage and session cookies.
 *
 * Consumers should still update the Zustand store via `useAuth` hooks rather
 * than calling these directly from components.
 */

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const session = await request<AuthSession>({
      url: '/auth/login',
      method: 'POST',
      data: credentials,
    });
    tokenStorage.setTokens(session.tokens);
    try {
      await syncSessionCookies(session.tokens);
    } catch {
      tokenStorage.clear();
      throw new Error('Could not start session on this site. Please try again.');
    }
    return session;
  },

  async logout(allDevices = false): Promise<void> {
    try {
      await request<null>({
        url: '/auth/logout',
        method: 'POST',
        data: { allDevices },
      });
    } finally {
      tokenStorage.clear();
      try {
        await clearSessionCookies();
      } catch {
        /* ignore */
      }
    }
  },

  async me(): Promise<AuthUser> {
    const { user } = await request<{ user: AuthUser }>({
      url: '/auth/me',
      method: 'GET',
    });
    return user;
  },

  async forgotPassword(email: string): Promise<void> {
    await request<null>({
      url: '/auth/forgot-password',
      method: 'POST',
      data: { email },
    });
  },

  async resetPassword(input: { token: string; password: string }): Promise<void> {
    await request<null>({
      url: '/auth/reset-password',
      method: 'POST',
      data: input,
    });
  },

  async changePassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
    await request<null>({
      url: '/auth/change-password',
      method: 'POST',
      data: input,
    });
  },
};
