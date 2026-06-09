# Frontend Architecture

> Feature-based, scalable SaaS dashboard. Every cross-cutting concern (state, API, theming, permissions) lives in a single, predictable place.

## Folder Map

```text
frontend/
├── src/
│   ├── app/                                       # Next.js App Router routes
│   │   ├── layout.tsx                             # Root layout: AppProviders + fonts
│   │   ├── page.tsx                               # Marketing landing
│   │   ├── error.tsx                              # Global error boundary
│   │   ├── loading.tsx                            # Root loader
│   │   ├── not-found.tsx                          # 404
│   │   ├── (auth)/                                # Guest-only segment
│   │   │   ├── layout.tsx                         # GuestGuard + AuthLayout
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   └── (dashboard)/                           # Protected segment
│   │       ├── layout.tsx                         # RouteGuard + DashboardLayout
│   │       └── dashboard/
│   │           ├── page.tsx                       # Overview (server wrapper)
│   │           ├── dashboard-overview.tsx         # Overview (client UI)
│   │           ├── students/page.tsx
│   │           ├── seats/page.tsx
│   │           ├── attendance/page.tsx
│   │           ├── payments/page.tsx
│   │           ├── reports/page.tsx
│   │           ├── analytics/page.tsx
│   │           ├── notifications/page.tsx
│   │           ├── staff/page.tsx
│   │           ├── branches/page.tsx
│   │           ├── settings/page.tsx
│   │           └── profile/page.tsx
│   │
│   ├── modules/                                   # Feature-based business modules
│   │   └── auth/
│   │       ├── auth.service.ts                    # Axios calls + token persistence
│   │       ├── auth.validation.ts                 # Zod schemas (login/register/...)
│   │       └── components/
│   │           ├── login-form.tsx
│   │           ├── register-form.tsx
│   │           ├── forgot-password-form.tsx
│   │           └── reset-password-form.tsx
│   │
│   ├── components/                                # Reusable presentation components
│   │   ├── auth/                                  # Can, RouteGuard, GuestGuard
│   │   ├── common/                                # Logo, PageHeader, EmptyState, ComingSoon, ThemeToggle
│   │   ├── layout/                                # Sidebar, TopNavbar, Mobile Sidebar, Breadcrumbs, UserMenu, NotificationMenu, SearchBar
│   │   └── ui/                                    # ShadCN-style primitives (button, dialog, dropdown, sheet, table, ...)
│   │
│   ├── layouts/                                   # AuthLayout, DashboardLayout
│   │
│   ├── providers/                                 # AppProviders composition
│   │   ├── theme-provider.tsx                     # next-themes
│   │   ├── query-provider.tsx                     # @tanstack/react-query + devtools
│   │   ├── auth-provider.tsx                     # Bootstraps session + auth:expired listener
│   │   └── index.tsx                              # Combines all of the above
│   │
│   ├── hooks/                                     # Reactive composables
│   │   ├── use-auth.ts                            # Reads store + mutations
│   │   ├── use-permissions.ts                     # can / canAll / canAny / hasRole
│   │   ├── use-debounce.ts
│   │   └── use-media-query.ts
│   │
│   ├── store/                                     # Zustand stores
│   │   └── auth.store.ts
│   │
│   ├── services/                                  # (reserved) cross-module API services
│   │
│   ├── lib/                                       # Pure-function utilities
│   │   ├── utils.ts                               # cn, getInitials, formatters
│   │   ├── env.ts                                 # Typed public env access
│   │   ├── token-storage.ts                       # localStorage tokens
│   │   ├── api-error.ts                           # ApiError + fromAxios()
│   │   ├── axios.ts                               # Instance + interceptors
│   │   ├── query-client.ts                       # React Query factory
│   │   └── permissions.ts                         # hasPermission / hasAnyPermission / hasRole
│   │
│   ├── types/                                     # Cross-module TypeScript types
│   │   ├── api.ts                                 # ApiSuccess / ApiErrorResponse / PaginationMeta
│   │   ├── auth.ts                                # AuthUser / AuthTokens / AuthSession
│   │   └── index.ts
│   │
│   ├── constants/                                 # Compile-time enums and registries
│   │   ├── routes.ts                              # ROUTES + PUBLIC_ROUTES + GUEST_ONLY_ROUTES
│   │   ├── permissions.ts                         # PERMISSIONS + ROLES (mirror of backend)
│   │   ├── navigation.ts                          # Sidebar nav definition + required permissions
│   │   └── index.ts
│   │
│   ├── styles/
│   │   └── globals.css                            # Tailwind layers + CSS variables (light/dark)
│   │
│   └── middleware.ts                              # Edge route protection (cookie presence)
│
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── .eslintrc.json
├── .env / .env.example
└── package.json
```

## Module Boundaries

- `app/` contains routes only (server components by default). Heavy interactive UI is delegated to client components inside `modules/<feature>/components/`.
- `modules/<feature>/` owns: `*.service.ts`, `*.validation.ts`, optional `*.permissions.ts`, and feature components.
- `components/` is for reusable, feature-agnostic UI. Never import a module from here.
- `layouts/` composes layout shells consumed by route segments. They do not own data fetching.
- `providers/` is mounted once at the root layout — order matters (`Theme -> Query -> Auth -> Tooltip`).
- `store/` is the only place Zustand stores live. Selectors are exported alongside the store.
- `lib/` is for pure functions only — no React, no Zustand.
- `constants/` are compile-time tables. Mirror only what the backend exposes.

## State Strategy

| Concern               | Where                       | Lifetime          |
|-----------------------|-----------------------------|-------------------|
| Auth user / status    | `store/auth.store.ts` (Zustand) | Session         |
| Server data           | `@tanstack/react-query`     | Per query, cached |
| Form state            | `react-hook-form`           | Per form          |
| Theme                 | `next-themes` (cookie/localStorage) | Persistent |
| Tokens                | `lib/token-storage.ts` (localStorage) + HttpOnly cookies | Session |

## API Strategy

- One axios instance (`lib/axios.ts`) with request + response interceptors.
- Errors are normalized to `ApiError` via `ApiError.fromAxios()` so callers can `instanceof`-check.
- React Query is configured to **not** retry 4xx errors (`createQueryClient()` in `lib/query-client.ts`).
- Each module exposes a small **service** object (e.g. `authService.login(...)`) that returns unwrapped data; React Query / mutations live in hooks.

## RBAC Strategy

- All permission strings live in `constants/permissions.ts` and mirror the backend.
- Use `<Can permission={...}>` in JSX or `usePermissions().can(...)` in callbacks.
- Never branch on `user.role === '...'`. Always express access as a permission.
- `SUPER_ADMIN` bypasses every check.

## Routing Strategy

- Two layout groups: `(auth)` is wrapped in `GuestGuard`; `(dashboard)` is wrapped in `RouteGuard`.
- `src/middleware.ts` provides an edge-level cookie presence check so unauthenticated visitors never see a flash of dashboard content.

## Naming Conventions

- Files: kebab-case for components (`user-menu.tsx`), camelCase for plain TS (`auth.service.ts`).
- Components: PascalCase. One default export per page; named exports for reusable components.
- Constants: SCREAMING_SNAKE in objects, e.g. `ROUTES.LOGIN`, `PERMISSIONS.STUDENT_CREATE`.
- Hooks: prefix with `use-` (`use-auth.ts` exporting `useAuth`).

## Adding a New Feature Module

1. Backend module is built and seeded (permissions exist).
2. Create `src/modules/<feature>/`:
   - `<feature>.service.ts`
   - `<feature>.validation.ts`
   - `components/`
3. Add nav entry in `constants/navigation.ts` with required permission(s).
4. Create the route under `src/app/(dashboard)/dashboard/<feature>/page.tsx`.
5. Use `<Can />` for action buttons; the sidebar will hide the nav item automatically when the user can't access any item action.

## Theming

- All colors are HSL variables in `globals.css` (`--background`, `--primary`, ...).
- Light + dark variants share the same token names, so all components remain theme-aware.
- Adding a new brand color: define `--<name>` and `--<name>-foreground` in both `:root` and `.dark`, then expose it in `tailwind.config.ts` under `theme.extend.colors`.
