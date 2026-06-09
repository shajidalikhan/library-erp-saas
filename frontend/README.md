# Library ERP &mdash; Frontend

Production-grade Next.js App Router frontend for the **Self Study Library ERP SaaS** platform.

- Next.js 14 (App Router) + React 18 + TypeScript (strict)
- Tailwind CSS 3 + ShadCN-style UI primitives (Radix UI)
- Zustand (auth/global state) + TanStack React Query (server cache)
- React Hook Form + Zod
- Axios with refresh-token interceptor
- Permission-based RBAC with `<Can />` and `RouteGuard`
- Light / dark / system theming (next-themes)

---

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

API base URL is read from `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:5000/api/v1`).

## Documentation

- [Setup](../docs/frontend-setup.md)
- [Auth flow](../docs/frontend-auth-flow.md)
- [Architecture](../docs/frontend-architecture.md)
- [Backend auth API contract](../docs/auth-api.md)

## Scripts

| Command              | What it does                              |
|----------------------|-------------------------------------------|
| `npm run dev`        | Start dev server on port 3000             |
| `npm run build`      | Production build                          |
| `npm start`          | Run the production build                  |
| `npm run lint`       | ESLint (next core-web-vitals)             |
| `npm run typecheck`  | TypeScript no-emit check                  |

## Routes overview

| Route               | Access                  | Notes                       |
|---------------------|-------------------------|-----------------------------|
| `/`                 | Public                  | Marketing landing           |
| `/login`            | Guest                   | Email + password            |
| `/register`         | Guest                   | LIBRARY_OWNER or STUDENT    |
| `/forgot-password`  | Guest                   | Request reset link (UI ready) |
| `/reset-password`   | Guest                   | Reset via token (UI ready)  |
| `/dashboard`        | Authenticated           | Overview                    |
| `/dashboard/*`      | Authenticated + RBAC    | Modules (placeholders ready)|

## Folder structure

See [docs/frontend-architecture.md](../docs/frontend-architecture.md) for the canonical map.
