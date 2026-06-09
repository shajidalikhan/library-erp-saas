import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { ENV } from './env';
import { syncSessionCookies } from './session-cookies';
import { tokenStorage } from './token-storage';
import { ApiError } from './api-error';
import type { ApiSuccess } from '@/types/api';

/**
 * Axios instance + interceptors.
 *
 * Responsibilities:
 *  1. Attach `Authorization: Bearer <access_token>` to every request.
 *  2. On 401, transparently attempt a single refresh, then retry the original
 *     request. Concurrent 401s share the same refresh promise so we never
 *     spam `/auth/refresh`.
 *  3. On refresh failure (or repeated 401), fire a `auth:expired` window
 *     event so the auth store can clear state and redirect to /login.
 *  4. Normalize errors to `ApiError`.
 *
 * NOTE: We deliberately export the raw instance for use in services. UI
 * code should NEVER call axios directly - always go through a service.
 */

const REFRESH_PATH = '/auth/refresh';

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _skipAuth?: boolean;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: ENV.API_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const cfg = config as RetryConfig;
  if (cfg._skipAuth) {
    // Public pages: do not send Bearer header or HttpOnly session cookies.
    cfg.withCredentials = false;
  } else {
    const token = tokenStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // Let the browser set multipart boundary; default JSON header breaks file uploads.
  if (config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Single in-flight refresh, shared across all concurrent 401s.
let refreshPromise: Promise<string | null> | null = null;

const performRefresh = async (): Promise<string | null> => {
  const refreshToken = tokenStorage.getRefreshToken();
  try {
    const res = await axios.post<{
      success: true;
      data: { tokens: { accessToken: string; refreshToken: string } };
    }>(
      `${ENV.API_BASE_URL}${REFRESH_PATH}`,
      refreshToken ? { refreshToken } : {},
      {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const { accessToken, refreshToken: nextRefresh } = res.data.data.tokens;
    tokenStorage.setTokens({ accessToken, refreshToken: nextRefresh });
    try {
      await syncSessionCookies({ accessToken, refreshToken: nextRefresh });
    } catch {
      /* middleware may be stale until next full sync; API still works */
    }
    return accessToken;
  } catch {
    return null;
  }
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    const status = error.response?.status;

    if (status === 403 && typeof window !== 'undefined') {
      const data = error.response?.data as
        | { code?: string; details?: { suspensionReason?: string | null; libraryName?: string } }
        | undefined;
      if (data?.code === 'TENANT_SUSPENDED') {
        const qs = new URLSearchParams();
        const d = data.details;
        if (d?.suspensionReason) qs.set('reason', String(d.suspensionReason));
        if (d?.libraryName) qs.set('library', String(d.libraryName));
        const q = qs.toString();
        window.location.replace(q ? `/tenant-suspended?${q}` : '/tenant-suspended');
        return Promise.reject(ApiError.fromAxios(error));
      }
    }

    // Anything other than a 401 or already-retried request -> bubble up.
    if (
      !original ||
      status !== 401 ||
      original._retry ||
      original.url?.includes(REFRESH_PATH)
    ) {
      return Promise.reject(ApiError.fromAxios(error));
    }

    // Public routes: do not attempt token refresh (avoids redirect loop on marketing pages).
    if (original._skipAuth) {
      return Promise.reject(ApiError.fromAxios(error));
    }

    // Don't try to refresh if we never had a session (e.g. login page).
    if (!tokenStorage.getAccessToken() && !tokenStorage.getRefreshToken()) {
      return Promise.reject(ApiError.fromAxios(error));
    }

    original._retry = true;

    refreshPromise = refreshPromise ?? performRefresh();
    const newAccessToken = await refreshPromise;
    refreshPromise = null;

    if (!newAccessToken) {
      tokenStorage.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
      return Promise.reject(ApiError.fromAxios(error));
    }

    if (original.headers) {
      original.headers.Authorization = `Bearer ${newAccessToken}`;
    }
    try {
      return await apiClient.request(original);
    } catch (retryErr) {
      return Promise.reject(ApiError.fromAxios(retryErr));
    }
  },
);

/**
 * Convenience: returns the `data` portion of an `ApiSuccess<T>` envelope.
 * Use in services so callers never deal with the envelope.
 */
export const request = async <T>(
  config: AxiosRequestConfig & { _skipAuth?: boolean },
): Promise<T> => {
  const res = await apiClient.request<{ data: T }>(config);
  return res.data.data;
};

/**
 * Like {@link request}, but preserves optional `meta` (pagination, etc.)
 * from the backend `ApiResponse` envelope.
 */
export const requestDataAndMeta = async <T>(
  config: AxiosRequestConfig & { _skipAuth?: boolean },
): Promise<{ data: T; meta?: ApiSuccess<T>['meta'] }> => {
  const res = await apiClient.request<ApiSuccess<T>>(config);
  return { data: res.data.data, meta: res.data.meta };
};
