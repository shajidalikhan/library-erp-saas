# Reports & exports (frontend)

## Routes

Defined in `src/constants/routes.ts`:

- `/dashboard/reports` — overview cards
- `/dashboard/reports/students`
- `/dashboard/reports/attendance`
- `/dashboard/reports/payments`
- `/dashboard/reports/invoices`
- `/dashboard/reports/seats`
- `/dashboard/reports/dues`
- `/dashboard/reports/collections` — daily + monthly tables
- `/dashboard/reports/branches`

Navigation: **Insights → Reports** (visible with `report.view` **or** `analytics.view`).

## Module layout

- `src/modules/reports/types.ts` — query param and envelope typings
- `src/modules/reports/reports.service.ts` — JSON list calls + `downloadReportFile` (blob download for exports)
- `src/modules/reports/export-download.ts` — `getExportMimeType()`, `getExportFilename()`, `getResponseHeader()`, `ensureDownloadFilename()` so the saved file uses API headers when available and never defaults to `.txt`
- `src/modules/reports/reports-query-keys.ts` — React Query keys
- `src/modules/reports/use-reports-scope.ts` — library / branch / range / custom dates; `scopedQueryEnabled` blocks queries until a super-admin picks a library and, for `custom` range, both dates are set
- `src/modules/reports/components/*` — filters bar, sub-nav, export buttons, preview table card

## UX

- **Filters:** library (super admin), branch, preset range, optional custom from/to dates.
- **Preview:** shadcn `Table` with simple prev/next pagination (server-driven `page` / `limit`).
- **Exports:** per-page buttons call `GET .../export?format=csv|xlsx|pdf` with the same scope params. The blob uses the response `Content-Type`; the download attribute uses `Content-Disposition` when CORS exposes it, otherwise `{fileBaseName}-YYYY-MM-DD.{ext}` (see backend CORS `exposedHeaders`).
- **Export UX:** buttons show a spinner while downloading, block overlapping runs, and emit toasts (started / success / failed).
- **Accountant:** student / attendance / seat report nav entries and pages are hidden when `role === ACCOUNTANT` even if `student.read` exists.

## API base URL

Uses `NEXT_PUBLIC_API_BASE_URL` (see `src/lib/env.ts`), default `http://localhost:5000/api/v1`.
