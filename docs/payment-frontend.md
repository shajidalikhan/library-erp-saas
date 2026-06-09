# Payments — Frontend

Next.js App Router under `frontend/src/app/(dashboard)/dashboard/payments/`. Shared UI and API clients live in `frontend/src/modules/payments/`.

## Routes (see `src/constants/routes.ts`)

| Path | Purpose |
| ---- | ------- |
| `/dashboard/payments` | Payments hub / entry. |
| `/dashboard/payments/fee-plans` | Fee plan list. |
| `/dashboard/payments/fee-plans/new` | Create fee plan. |
| `/dashboard/payments/invoices` | Invoice list. |
| `/dashboard/payments/invoices/new` | Create invoice. |
| `/dashboard/payments/invoices/[invoiceId]` | Invoice detail. |
| `/dashboard/payments/collect` | Collect payment against an invoice. Optional query: `?invoiceId=` to preselect an open invoice (e.g. from the invoice list **Collect** action). |
| `/dashboard/payments/dues` | Dues (open balances). |
| `/dashboard/payments/overdue` | Overdue invoices. |
| `/dashboard/payments/receipts/[paymentId]` | Receipt view. |
| `/dashboard/payments/students/[studentId]/history` | Staff view of student payment history. |

Helpers: `paymentInvoiceRoute`, `paymentReceiptRoute`, `paymentCollectRoute(invoiceId?)`, `paymentStudentHistoryRoute`.

## Student portal

| Path | Purpose |
| ---- | ------- |
| `/dashboard/student/payments` | Logged-in student’s wallet (`GET /students/me/payments`). |

Route constant: `ROUTES.MY_PAYMENTS`.

## Sidebar (`src/constants/navigation.ts`)

Operations section includes **Payments**, **Invoices**, **Fee plans**, and **Dues** where the user has the matching permissions (`payment.read`, `feePlan.read`).

## Permissions (UI)

- Fee plan screens: `feePlan.*` as appropriate.
- Invoice list/detail, dues, overdue, collect, receipts, student history: primarily `payment.read` / `payment.create` / `payment.update` depending on action.
- Student detail **Payments** tab: uses `payment.read` to load `studentHistory` and show tables; without it, a short permission message is shown.

## Data fetching

React Query keys live in `frontend/src/modules/payments/payment-query-keys.ts`. HTTP calls go through `frontend/src/modules/payments/payment.service.ts` (`paymentApi`) and the shared Axios instance with auth headers.

## Tenant-aware create flows

**Fee plan (`fee-plans/new`)** and **invoice (`invoices/new`)** resolve library/branch from the signed-in user:

| Role | Library | Branch |
| ---- | ------- | ------ |
| `SUPER_ADMIN` | Searchable **Library** dropdown | **Branch** dropdown for that library |
| `LIBRARY_OWNER` | Fixed from JWT | **Branch** dropdown if the user has no branch on JWT; otherwise read-only |
| `MANAGER` / `RECEPTIONIST` / `ACCOUNTANT` | Fixed from JWT | Read-only from JWT (both required on the user) |

Invoices: pick **student** and optional **fee plan** via searchable selectors (no raw Mongo IDs). Selecting a fee plan auto-fills amount and shows a short plan summary card; clear the plan to enter a manual amount.

## Shared selectors (`src/components/selectors/`)

| Component | Data source | Notes |
| --------- | ----------- | ----- |
| `LibrarySelect` | `GET /libraries` | Search + popover list; loading / empty states. |
| `BranchSelect` | `GET /libraries/:libraryId/branches` | Search + list; can lock display when `lockedLibraryId` + `lockedBranchId` match branch-bound staff. |
| `StudentSelect` | `GET /students` with `libraryId`, `branchId`, `search` | Label shows name, student id, phone. |
| `FeePlanSelect` | `GET /payments/fee-plans` with `libraryId`, `branchId`, `active=true` | Optional clear for manual billing. |
| `InvoiceSelect` | `GET /payments/invoices` with `hasOpenBalance=true`, debounced `search` | Collect flow: searchable open invoices; option line shows invoice #, student, ID, seat, due. Pass `selectedInvoice` when the row is known from a deep link prefetch. |

## Collect payment UX

- **Invoice**: `InvoiceSelect` instead of pasting Mongo ids; amount defaults to **due**; overpayment requires `payment.update` and the **Allow overpayment** checkbox (mirrors `allowOverpayment` on `POST /payments/collect`).
- **Summary card**: After selection (or `?invoiceId=`), shows student, phone, seat, branch, totals, due date, status.
- **Super admin**: Library + branch pickers align list/collect queries with tenant scope before loading invoices.

## Invoice list

- Table columns: invoice no., student, student id, phone, seat, branch, fee plan (when set), due date, total, paid, due, status, actions (**View**, **Collect** when there is open balance, **Receipt** when `lastPaymentId` is present).
- Toolbar: search (same fields as API `search`), status, due date range; super admin: library + branch.

## Components (payments module)

Reusable pieces include `InvoiceStatusBadge`, `PaymentMethodBadge`, and table-driven list pages aligned with the design system (Shadcn UI, Tailwind).
