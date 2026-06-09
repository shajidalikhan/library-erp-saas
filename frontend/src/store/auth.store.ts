import { create } from 'zustand';
import type { AuthUser } from '@/types/auth';

/**
 * Global auth state.
 *
 * Source of truth for `user` (and derived `isAuthenticated`).
 * Token storage lives in `lib/token-storage` (localStorage) so the Axios
 * interceptor can read tokens without subscribing to this store.
 *
 * Hydration:
 *   - `status` starts as 'idle'.
 *   - On app boot, `AuthBootstrap` provider calls `bootstrap()` which
 *     transitions: idle -> loading -> authenticated | unauthenticated.
 *   - Login/logout/refresh actions update both store and token storage.
 */

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  // actions
  setUser: (user: AuthUser | null) => void;
  setStatus: (status: AuthStatus) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  setUser: (user) =>
    set({
      user,
      status: user ? 'authenticated' : 'unauthenticated',
    }),
  setStatus: (status) => set({ status }),
  reset: () => set({ user: null, status: 'unauthenticated' }),
}));

/** Selector helpers (use these in components to keep re-renders narrow). */
export const selectUser = (s: AuthState) => s.user;
export const selectAuthStatus = (s: AuthState) => s.status;
export const selectIsAuthenticated = (s: AuthState) => s.status === 'authenticated';
