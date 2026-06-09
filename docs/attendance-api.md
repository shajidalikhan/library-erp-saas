# Attendance API

> Module: `backend/src/modules/attendance`  
> Base path: `/attendance` (under `/api/v1`)

Attendance records are tenant-scoped by `libraryId` and `branchId`, and linked to `studentId` and `seatId`.

## Permissions

| Permission | Purpose |
|---|---|
| `attendance.read` | Daily lists, active check-ins, student history |
| `attendance.create` | Manual entry |
| `attendance.update` | Notes/status/timestamps correction |
| `attendance.checkIn` | Check-in operation |
| `attendance.checkOut` | Check-out operation |
| `attendance.summary` | Aggregated summary |

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/attendance/check-in` | Check in student (prevents double active check-in) |
| `POST` | `/attendance/check-out` | Check out active session |
| `POST` | `/attendance/manual` | Manual attendance entry |
| `GET` | `/attendance/daily` | Daily list with pagination/search/filter/sort |
| `GET` | `/attendance/active` | Active check-ins |
| `GET` | `/attendance/students/:studentId/history` | Student history |
| `GET` | `/attendance/summary` | KPI summary + branch-wise counts |
| `PATCH` | `/attendance/:attendanceId` | Update note/status/check-in/check-out/method |

## Validation and business rules

- Student must be inside tenant scope.
- Seat (if provided) must belong to the same library/branch as the student.
- Student cannot check in twice while previous record has `checkOutAt: null`.
- Checkout requires active check-in.
- `durationMinutes` is auto-calculated from check-in/check-out.
- Attendance `date` is normalized to library timezone date key (`Library.timezone` fallback `Asia/Kolkata`).

## Statuses and methods

- Status: `PRESENT`, `LATE`, `ABSENT`, `EARLY_EXIT`, `CHECKED_IN`, `CHECKED_OUT`
- Method: `MANUAL`, `QR`, `RFID`, `BIOMETRIC`

`QR/RFID/BIOMETRIC` are future-ready enum values; current flow remains API/manual.
