# Attendance Frontend

## Module

- `src/modules/attendance/`
  - `attendance.service.ts` (Axios integration)
  - `attendance-query-keys.ts` (React Query keys)
  - `types.ts`
  - `components/attendance-status-badge.tsx`

## Pages

| Page | Path |
|---|---|
| Dashboard | `/dashboard/attendance` |
| Daily Attendance | `/dashboard/attendance/daily` |
| Check-In / Check-Out | `/dashboard/attendance/check-in` |
| Active Check-Ins | `/dashboard/attendance/active` |
| Student Attendance History | `/dashboard/attendance/students/:studentId` |
| Attendance Summary | `/dashboard/attendance/summary` |

## UX highlights

- KPI cards on dashboard.
- Debounced student search for quick check-in/check-out.
- Active check-ins table with one-click checkout.
- Daily table with status filters and pagination.
- Daily and active attendance rows include **View Student Details** deep-link (`/dashboard/students/:studentId?tab=attendance`).
- Student history page for per-student attendance trail.
- Status badge component for consistent visual language.

## Permission rendering

UI actions are permission-gated (e.g. `attendance.checkIn`, `attendance.checkOut`, `attendance.read`, `attendance.summary`) using the shared permission system (`usePermissions` / `Can` pattern), never role string checks for action rendering.

## Data integration

- React Query for caching and refetching.
- Axios service layer only (`attendanceApi`).
- Invalidates attendance query keys after mutations for fresh dashboards/tables.
- Student detail page reads `?tab=attendance` and opens the Attendance tab automatically.
