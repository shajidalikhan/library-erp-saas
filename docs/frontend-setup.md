# Frontend Setup

> Project: `frontend/` &mdash; Next.js App Router + TypeScript + Tailwind + ShadCN UI

---

## Prerequisites

- Node.js **>= 20**
- npm 10+ (or pnpm / yarn equivalent)
- The backend is running locally on `http://localhost:5000` (or update env)

## Install

```bash
cd frontend
npm install
```

## Configure environment

```bash
cp .env.example .env
```

`.env` keys (all `NEXT_PUBLIC_*` so they ship to the browser):

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME`     | `Library ERP`              | Brand / page title |
| `NEXT_PUBLIC_APP_URL`      | `http://localhost:3000`    | Frontend origin |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5000/api/v1` | Backend API |

## Scripts

| Command         | What it does                                              |
|-----------------|-----------------------------------------------------------|
| `npm run dev`   | Start the dev server on port 3000                         |
| `npm run build` | Production build (Next + type-check + lint)              |
| `npm start`     | Run the production build                                  |
| `npm run lint`  | Run ESLint (Next.js config)                               |
| `npm run typecheck` | `tsc --noEmit`                                       |

## First Run Checklist

1. Make sure the backend RBAC seeder has been executed (`npm run seed:rbac` inside `backend/`).
2. Start the backend (`npm run dev` inside `backend/`).
3. Start the frontend (`npm run dev` inside `frontend/`).
4. Open <http://localhost:3000>.

## Default ports

| Service  | Port  |
|----------|-------|
| Frontend | 3000  |
| Backend  | 5000  |

## Stack

- **Framework**:  Next.js 14 (App Router) + React 18
- **Language**:   TypeScript (strict)
- **Styling**:    Tailwind CSS 3 + shadcn-style UI primitives (Radix UI)
- **State**:      Zustand (client global) + TanStack React Query (server cache)
- **Forms**:      React Hook Form + Zod
- **HTTP**:       Axios with refresh-token interceptor
- **Icons**:      lucide-react
- **Theming**:    next-themes (light / dark / system)
- **Toasts**:     sonner
