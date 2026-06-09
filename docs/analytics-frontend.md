# Analytics — Frontend

## Location

- **Routes:** `frontend/src/app/(dashboard)/dashboard/analytics/` (layout + sub-pages).
- **Module:** `frontend/src/modules/analytics/` (`analytics.service.ts`, `types.ts`, `analytics-query-keys.ts`, `use-analytics-scope.ts`, `components/`).

## Paths (see `src/constants/routes.ts`)

| Constant | Path |
| -------- | ---- |
| `ROUTES.ANALYTICS` | `/dashboard/analytics` |
| `ROUTES.ANALYTICS_REVENUE` | `/dashboard/analytics/revenue` |
| `ROUTES.ANALYTICS_STUDENTS` | `/dashboard/analytics/students` |
| `ROUTES.ANALYTICS_SEATS` | `/dashboard/analytics/seats` |
| `ROUTES.ANALYTICS_ATTENDANCE` | `/dashboard/analytics/attendance` |
| `ROUTES.ANALYTICS_PAYMENTS` | `/dashboard/analytics/payments` |
| `ROUTES.ANALYTICS_BRANCHES` | `/dashboard/analytics/branches` |

## Navigation & RBAC

- Sidebar **Analytics** (Insights) requires `analytics.view` or `report.view` (unchanged).
- **Sub-nav** tabs are permission-filtered (e.g. Attendance only with `attendance.read`, Revenue/Payments/Branches with `payment.read`).
- **Never** branch UI on `user.role === '…'` for admin-style checks; use `usePermissions().can` / `canAny`.

## Super admin

- **Library** + **Branch** selectors on analytics pages (`LibrarySelect`, `BranchSelect`).
- Operational endpoints (students / seats / attendance / branches) are **disabled** until a library is chosen (`scopedQueryEnabled`), to avoid unscoped cross-tenant list explosion.

## Charts

Uses **Recharts** (`recharts`): line (revenue), area (attendance / hub combo), bar (floors, monthly), pie (payment methods).

## Dashboard home

`dashboard-overview.tsx` loads `GET /analytics/overview` when the user has `analytics.view` or `report.view`, and maps KPI cards to `student.read`, `seat.read`, `attendance.read`, and `payment.read` via `<Can>` wrappers.
