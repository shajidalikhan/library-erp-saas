# Reports & exports API

Base path: `GET /api/v1/reports/...` (see `ENV.API_PREFIX`). All routes require `Authorization: Bearer <accessToken>`.

## RBAC

- **Gate:** `report.view` **or** `analytics.view` (same pattern as analytics dashboards).
- **Students / attendance / seats:** additionally require `student.read`, `attendance.read`, or `seat.read` / `seat.occupancy.read` respectively. The **accountant** role is blocked from these operational datasets in the service layer (finance-only).
- **Payments / invoices / dues / collections:** additionally require `payment.read`.
- **Branches:** `branch.read` **or** `payment.read` (accountants can load branch metrics via finance access).
- **STUDENT** users: admin reports are forbidden (`assertReportAccess`).

## Super admin scoping

For all list and export handlers, **SUPER_ADMIN** must supply `libraryId` in the query string. Without it, the API responds `400 libraryId is required for platform administrators`.

## Shared query parameters

Validated by `reportListQuerySchema` / `reportExportQuerySchema` (see `reports.validation.ts`):

| Parameter       | Notes |
|----------------|-------|
| `libraryId`    | ObjectId; required for SUPER_ADMIN |
| `branchId`     | Optional branch filter; must belong to the library |
| `fromDate` / `toDate` | ISO datetimes; optional |
| `range`        | `7d` \| `30d` \| `90d` \| `365d` \| `custom` (default `30d`) |
| `page`, `limit`| Pagination (`limit` max 100) |
| `search`       | Students: name / ID / email / phone regex |
| `status`       | Students: student status; attendance: attendance status; payments: payment record status (defaults to `ACTIVE` when omitted) |
| `studentId` / `seatId` | ObjectId filters |
| `paymentMethod`| Enum from payment constants |
| `invoiceStatus`| Invoice status enum |
| `sortBy` / `sortOrder` | Whitelisted per dataset (`asc` / `desc`) |

Exports add **`format`**: `csv` \| `xlsx` \| `pdf`. Rows are capped at **8000** per export.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/students` | Paginated students created in the resolved date window |
| GET | `/reports/students/export` | CSV / XLSX / PDF |
| GET | `/reports/attendance` | Paginated attendance with student name (aggregation + facet) |
| GET | `/reports/attendance/export` | |
| GET | `/reports/payments` | Payments with `invoiceNumber` via `$lookup` |
| GET | `/reports/payments/export` | |
| GET | `/reports/invoices` | Invoices with student name |
| GET | `/reports/invoices/export` | |
| GET | `/reports/seats` | Active seats updated in range; assigned student name |
| GET | `/reports/seats/export` | |
| GET | `/reports/dues` | Invoices with `dueAmount > 0` and status in unpaid set (override with `invoiceStatus`) |
| GET | `/reports/dues/export` | |
| GET | `/reports/branches` | Branch directory + parallel aggregates for students, seats, payments in range |
| GET | `/reports/collections/daily` | `{ series: [{ date, amount, count }], totalAmount, range }` |
| GET | `/reports/collections/monthly` | `{ series: [{ month, amount, count }], totalAmount, range }` |

List responses use the standard envelope: `{ success, data: { items, meta: { pagination }, range }, message }`.

Export responses are **raw files** (not JSON) with:

- `Content-Type`: `text/csv` (CSV), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (XLSX), `application/pdf` (PDF)
- `Content-Disposition: attachment; filename="<ascii-safe-name>"` where the extension always matches `format`
- `Cache-Control: no-store`

CORS exposes `Content-Type` and `Content-Disposition` so browser clients on another origin can read filenames for downloads (see `app.ts` `exposedHeaders`).

## Implementation notes

- Tenant match is built in `reports-scope.ts` (`buildTenantMatch`, `validateBranchQuery`, `resolveDateRange`).
- Aggregations use `PipelineStage[]` typing and `$facet` for pagination to avoid N+1 patterns on heavy joins.
- CSV uses `csv-stringify`, XLSX uses `exceljs`, PDF uses `pdfkit` (`reports-export.util.ts`).
