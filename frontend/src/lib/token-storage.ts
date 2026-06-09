/**
 * Token storage abstraction.
 *
 * Stored in localStorage so the SPA can attach the access token to Axios
 * requests without depending on cookies (the backend also issues HttpOnly
 * cookies, but mobile / Postman / cross-origin SPA use cases benefit from
 * an explicit Bearer header).
 *
 * Refresh tokens are also persisted for client-driven refresh; in browser
 * deployments behind the same origin you can rely on the HttpOnly cookie
 * alone and skip persisting the refresh token at all - keep the API the
 * same so callers don't change.
 */

const ACCESS_TOKEN_KEY = 'lib_erp.access_token';
const REFRESH_TOKEN_KEY = 'lib_erp.refresh_token';

const isBrowser = (): boolean => typeof window !== 'undefined';

export const tokenStorage = {
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setTokens(tokens: { accessToken: string; refreshToken: string }): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },
  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};
