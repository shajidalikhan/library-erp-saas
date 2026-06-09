# Analytics API

Base: `{API_PREFIX}` (default `/api/v1`). All routes require authentication.

## Permissions

| Gate | Notes |
| ---- | ----- |
| `analytics.view` **or** `report.view` | Required for every analytics route (middleware `authorizeAny`). `SUPER_ADMIN` bypasses permission checks. |
| `student.read` | Required for `GET /analytics/students`. |
| `seat.read` **or** `seat.occupancy.read` | Required for `GET /analytics/seats`. |
| `attendance.read` | Required for `GET /analytics/attendance`. |
| `payment.read` | Required for `GET /analytics/revenue`, `/analytics/payments`, `/analytics/branches`, `/analytics/trends/daily`, `/analytics/trends/monthly`. |

The **overview** response omits metrics the caller is not allowed to see (fields are set to `null` instead of leaking aggregates).

## Tenant scope

| Role | `libraryId` / `branchId` query |
| ---- | -------------------------------- |
| `SUPER_ADMIN` | Optional filters; omit both for **global** aggregates (overview platform block, cross-library revenue where applicable). |
| `LIBRARY_OWNER` | JWT library is enforced; optional `branchId` when the user has no branch on the token. |
| `MANAGER` | JWT `libraryId` + `branchId` enforced; query `branchId` cannot differ from JWT. |
| `ACCOUNTANT` | Same tenant rules as other staff; finance routes require `payment.read`. |

## Query parameters (all GET)

Shared validation (`analyticsQuerySchema`):

| Field | Description |
| ----- | ----------- |
| `libraryId` | ObjectId; super-admin only. |
| `branchId` | ObjectId; optional branch filter (must belong to selected / JWT library). |
| `fromDate`, `toDate` | ISO datetime; **custom** window (both recommended together). |
| `range` | `7d` \| `30d` \| `90d` \| `365d` \| `custom` — default `30d` when dates omitted. |

## Endpoints

### `GET /analytics/overview`

KPI snapshot: students, seats, occupancy, invoices, payments (MTD / today / lifetime), pending dues, active check-ins, today’s check-in count, optional **platform** block for super-admin without `libraryId`.

### `GET /analytics/students`

`byBranch`, `byMembershipStatus`, `newStudentTrend`, `activeVsInactive`, `seatUtilizationPct`, `range`.

### `GET /analytics/seats`

`byBranch`, `byFloor`, `byZone`, `byStatus` (seat status counts).

### `GET /analytics/attendance`

`dailyTrend`, `averageDurationMinutes`, `peakCheckInHours`, `activeCheckIns`, `byBranch`, `range`.

### `GET /analytics/revenue`

`{ trend: [{ date, amount }], totalInRange, range }` — daily buckets from **payments** (`paidAt`).

### `GET /analytics/payments`

Payment analytics: `methodDistribution`, `branchWiseCollection`, `overdueTrend`, `dueTrend`, `collectionEfficiencyPct`, `currentOverdueInvoices`, `invoiceStatusBreakdown`, `range`.

### `GET /analytics/branches`

Per-branch table data: students, seats, occupancy, revenue in range, attendance sessions in range.

### `GET /analytics/trends/daily`

Merged series: `{ date, revenue, attendance, newStudents }` per day (revenue requires `payment.read`; attendance and new-student series omitted when the user lacks the respective read permissions).

### `GET /analytics/trends/monthly`

`{ series: [{ month, revenue, attendance }], range }`.

## Performance

- Heavy reads use MongoDB **aggregation** and `lean`-friendly pipelines.
- Composite index added on payments: `{ libraryId: 1, status: 1, paidAt: -1 }` for time-range revenue queries.
