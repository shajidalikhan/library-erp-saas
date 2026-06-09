# Frontend Auth Flow

> Mirrors the contract enforced by [`docs/auth-api.md`](./auth-api.md).

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Pages (Login / Register / Forgot / Reset)                  │
│    └── Forms: react-hook-form + zod + auth.validation.ts    │
└────────────────────────┬────────────────────────────────────┘
                         │ useAuth() hook
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  hooks/use-auth.ts                                          │
│    - login / register / logout / refreshMe (React Query)    │
│    - syncs Zustand auth store + router.replace              │
└────────────────────────┬────────────────────────────────────┘
                         │
       ┌─────────────────┼─────────────────────────┐
       ▼                 ▼                         ▼
┌─────────────┐  ┌────────────────────┐  ┌──────────────────┐
│ store/auth  │  │ modules/auth/      │  │ lib/token-storage │
│ zustand     │  │  auth.service.ts   │  │ (localStorage)   │
│ user/status │  │  axios calls       │  │  read by axios   │
└─────────────┘  └────────────────────┘  └──────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  lib/axios.ts                                               │
│   - request interceptor: Authorization: Bearer <token>      │
│   - response interceptor: 401 → POST /auth/refresh → retry  │
│   - shared in-flight refresh promise (no thundering herd)   │
│   - on hard failure: dispatch `auth:expired`                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                  Backend `/api/v1/auth/*`
```

## Tokens

| Token | Where | Purpose |
|---|---|---|
| Access  | `localStorage["lib_erp.access_token"]` &nbsp; AND &nbsp; HttpOnly cookie set by backend | Short-lived (default 15m) |
| Refresh | `localStorage["lib_erp.refresh_token"]` &nbsp; AND &nbsp; HttpOnly cookie | Long-lived (default 7d), rotated on each refresh |

The Axios interceptor attaches `Authorization: Bearer <access_token>` to every request. Cookies are also sent (`withCredentials: true`) so server-side middleware (`src/middleware.ts`) can do a presence-only check.

## Refresh Flow

1. A request returns **401**.
2. The interceptor sets `_retry = true` on the request config and awaits a single in-flight `performRefresh()` promise.
3. `performRefresh()` calls `POST /auth/refresh` with the stored refresh token in the body. Backend rotates the pair and returns new tokens.
4. New tokens are saved in `tokenStorage`. The original request is retried once with the new access token.
5. If the refresh fails (or no refresh token exists), tokens are cleared and a `auth:expired` window event is dispatched.

## Session Expiry

`AuthProvider` listens for `auth:expired` and:

- clears the auth store (`reset()`)
- redirects to `/login`

This event is the **only** path through which a normal user lands on `/login` after their session dies — everywhere else, the in-flight refresh keeps them signed in.

## Login / Register / Logout (component perspective)

```ts
const { login, register, logout, user, isAuthenticated } = useAuth();

// Login
await login({ email, password });   // mutateAsync from React Query
// → AuthService.login() → token storage → store.setUser() → router.replace(/dashboard)

// Register
await register({ fullName, email, password, role: 'LIBRARY_OWNER' });

// Logout
await logout(false);                // false = current device; true = all devices
```

## Persistent Login

On every mount (`<AuthProvider />`):

1. Read tokens from `tokenStorage`.
2. If found, set `status = 'loading'`, call `GET /auth/me`, then put the user into the store.
3. If `me` returns 401/403, the interceptor retries via refresh; if that fails too, we clear and redirect to `/login`.

This means **a page refresh after login does NOT bounce the user back to /login** as long as the refresh token is still valid.

## Route Protection (defence in depth)

Three layers, top to bottom:

| Layer | Where | Checks |
|---|---|---|
| 1. Edge (server)    | `src/middleware.ts`           | Cookie presence only |
| 2. Layout segment   | `(dashboard)/layout.tsx` -> `RouteGuard` | Cookie + store + permissions/roles |
| 3. Component        | `<Can />` and `usePermissions().can()` | Per-element permission gating |

Why three layers?

- **Edge** prevents the dashboard from flashing for logged-out visitors.
- **RouteGuard** is the source of truth (it reads the live store after `me`).
- **<Can />** keeps individual buttons / sections from showing for users who shouldn't see them, regardless of how they got onto the page.

## Permission Gating (`<Can />`)

```tsx
import { Can } from '@/components/auth/can';
import { PERMISSIONS } from '@/constants/permissions';

<Can permission={PERMISSIONS.STUDENT_CREATE}>
  <Button>New Student</Button>
</Can>

<Can permission={[PERMISSIONS.PAYMENT_READ, PERMISSIONS.PAYMENT_CREATE]} all>
  ...
</Can>

<Can role="LIBRARY_OWNER" fallback={<p>Owners only.</p>}>
  ...
</Can>
```

`SUPER_ADMIN` bypasses every permission check (see `lib/permissions.ts`).

## Error UX

- Validation issues (422 / 400) → field-level `FormMessage`
- 401 on login → inline alert "Invalid email or password"
- 409 on register → email field error
- All others → `sonner` toast with the API's `message`
- Hard crashes → `app/error.tsx` global error boundary
