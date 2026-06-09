# Seats frontend

## Module

- `src/modules/seats/` — `seat.service.ts` (Axios), `types.ts`, `schemas.ts` (Zod for forms), `seat-query-keys.ts`, UI: `components/seat-status-badge.tsx`, `components/seat-grid-view.tsx`.

## Routes (`src/constants/routes.ts`)

| Page | Path |
|------|------|
| List | `/dashboard/seats` |
| New | `/dashboard/seats/new` |
| Detail | `/dashboard/seats/:seatId` |
| Edit | `/dashboard/seats/:seatId/edit` |
| Assign | `/dashboard/seats/:seatId/assign` |
| Bulk | `/dashboard/seats/bulk` |
| Occupancy | `/dashboard/seats/occupancy` |
| Grid | `/dashboard/seats/grid` |

## Permissions

Sidebar **Seats** requires `seat.read` **or** `seat.occupancy.read`. Individual actions use `<Can permission={…}>` (never raw role checks).

- **Grid** view requires `seat.read` (full layout).
- **Occupancy** dashboard allows occupancy-only roles.

## UX

- List: server pagination, debounced search, filters, column visibility, status badges, delete confirmation.
- Forms: React Hook Form + Zod (`@hookform/resolvers`).
- Data: TanStack Query; keys centralized in `seat-query-keys.ts`.

## API base URL

Set `NEXT_PUBLIC_API_URL` (see `frontend` env docs) so services hit the same `/api/v1` prefix as the backend.
