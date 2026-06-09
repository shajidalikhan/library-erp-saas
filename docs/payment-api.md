# Payments API

Base: `{API_PREFIX}` (default `/api/v1`). Routes under this module require authentication unless noted otherwise.

## Permissions

| Permission | Purpose |
| ---------- | ------- |
| `feePlan.create` | Create fee plans for a branch. |
| `feePlan.read` | List/read fee plans (also allowed with `payment.read` / `payment.create` for list). |
| `feePlan.update` | Update fee plan fields. |
| `feePlan.delete` | Soft-deactivate a fee plan (`active: false`). |
| `payment.read` | List invoices, dues, overdue, payments, receipts, student history, student portal data where applicable. |
| `payment.create` | Create invoices and collect payments. |
| `payment.update` | Patch invoices; required when `allowOverpayment` is true on collect. |
| `payment.delete` | Void a payment record. |
| `payment.refund` | Record a refund against a payment. |
| `payment.summary` | Aggregated collection report for a date range. |

Default **seeded** role mapping (see `npm run seed:rbac`): `LIBRARY_OWNER` has full **fee plan** create/read/update/delete. `MANAGER` has **`feePlan.read`** only (no fee-plan mutations). `RECEPTIONIST` and `ACCOUNTANT` have **`feePlan.read`** so they can pick plans when creating invoices; fee-plan administration remains with the library owner (and `SUPER_ADMIN`).

`SUPER_ADMIN` bypasses permission checks but still follows tenant rules where the service applies explicit library/branch guards.

## Tenant and branch scope

- **JWT `libraryId` / `branchId`**: Non–super-admin users are scoped to their library. Branch-bound staff (`branchId` set) only see and mutate rows for that branch.
- **Super admin**: Optional `libraryId` / `branchId` query filters on list endpoints; mutations resolve tenant from the target branch or invoice.

## Fee plans

### `POST /payments/fee-plans`

Body: `branchId`, `name`, `amount` (non-negative), `durationDays` (positive integer), optional `description`, `active` (default true), optional `libraryId`.

- **`SUPER_ADMIN`**: **`libraryId` is required** and must match the library that owns `branchId` (the branch document is the source of truth for `libraryId` on the stored fee plan).
- **Tenant roles (`LIBRARY_OWNER`, branch-bound staff)**: `libraryId` in the body is ignored; the caller’s JWT library (and branch, when set) must match the target branch.

Branch-bound users may only use their own `branchId`. Library owners without a branch on the JWT pick any branch in their library via `branchId`.

### `GET /payments/fee-plans`

Pagination (`page`, `limit`), `search`, `active`, `branchId`, `libraryId` (super-admin), `sortBy` (`createdAt` | `name` | `amount`), `sortOrder`.

### `PATCH /payments/fee-plans/:feePlanId`

Partial update; `branchId` cannot be changed.

### `DELETE /payments/fee-plans/:feePlanId`

Sets `active` to false.

## Invoices

### `POST /payments/invoices`

Requires `payment.create`.

Body: `branchId`, `studentId`, `dueDate`; optional **`libraryId`** (required for `SUPER_ADMIN`, must match the branch’s library), `feePlanId`, `seatId`, `amount` (required if `feePlanId` omitted), `discountAmount`, `taxAmount`, `notes`, `status` (`DRAFT` | `UNPAID`, default `UNPAID`), membership period fields.

The student and optional fee plan must belong to the same **`libraryId` + `branchId`** as the invoice branch.

If `feePlanId` is set, the plan must be active and belong to the same library and branch; when `amount` is omitted, the plan’s `amount` is used.

### `GET /payments/invoices`

List with pagination and **enriched rows** for the UI (joins student, branch, seat, fee plan, and latest active payment metadata). Each item includes the usual invoice fields plus, when available: `invoiceId` (string copy of `_id`), `studentName`, `studentCode`, `studentPhone`, `seatNumber`, `branchName`, `feePlanName`, `lastPaymentId`, `hasActivePayments`.

**Query parameters**

| Parameter | Notes |
| --------- | ----- |
| `page`, `limit` | Pagination (default `page=1`, `limit=20`, max `limit=100`). |
| `search` | Case-insensitive match on **invoice number**, student **fullName**, **phone**, **studentId** (code), or **seat number**. |
| `status` | One invoice status, or omit for all (subject to `hasOpenBalance` / `overdueOnly` defaults below). |
| `studentId`, `branchId`, `libraryId` | Filters; **`SUPER_ADMIN`** should pass `libraryId` / `branchId` when scoping a tenant. |
| `seatId`, `invoiceId` | Optional ObjectId filters (`invoiceId` loads a single row when valid). |
| `dueAfter`, `dueBefore` | Inclusive due-date range (ISO date/datetime). |
| `hasOpenBalance` | `true` \| `false` — when `true`, restricts to invoices with **dueAmount** above epsilon and status **not** in `PAID`, `CANCELLED`, `REFUNDED`, `DRAFT`. |
| `overdueOnly` | `true` \| `false` — when `true`, status in `UNPAID` / `PARTIAL` / `OVERDUE`, positive due, and `dueDate` before now. Explicit `status` wins over these defaults. |
| `sortBy`, `sortOrder` | `sortBy`: `createdAt` \| `dueDate` \| `totalAmount` \| `dueAmount` \| `invoiceNumber`. |

**Student role**: only own invoices; `studentId` query must match the linked student or the request is rejected.

Single-invoice GET (`GET /payments/invoices/:invoiceId`) is unchanged; list enrichment is list-only.

### `GET /payments/invoices/dues`

Open balances: `dueAmount > 0` and status in `UNPAID`, `PARTIAL`, `OVERDUE`. Same scope rules as invoice list.

### `GET /payments/invoices/overdue`

Promotes eligible invoices to `OVERDUE`, then lists overdue rows (past `dueDate`, positive due, relevant statuses).

### `GET /payments/invoices/:invoiceId`

Returns the invoice; recalculates financial fields and persisted status (e.g. `OVERDUE` when past due).

### `PATCH /payments/invoices/:invoiceId`

Requires `payment.update`. Partial update: tax/discount only while no payments recorded; status transitions (e.g. `CANCELLED` only when `paidAmount` is zero).

## Collect payment

### `POST /payments/collect`

Requires `payment.create`.

Body: `invoiceId`, `amount` (positive), `method` (`CASH` | `UPI` | `CARD` | `BANK_TRANSFER` | `WALLET` | `OTHER`), optional `transactionId`, `paidAt`, `notes`, `allowOverpayment` (default false).

- Draft, cancelled, or fully refunded invoices cannot be collected.
- By default, `amount` must not exceed the current **due** amount (overpayment returns `400`).
- If `allowOverpayment` is true, the caller must also have **`payment.update`**.

Response: `{ payment, invoice }` with updated balances and invoice status (`PARTIAL`, `PAID`, etc.).

## Payments and receipts

### `GET /payments/payments`

Lists payment records (`status: ACTIVE`) with filters: `studentId`, `invoiceId`, `branchId`, `libraryId`, `method`, `from`, `to`, pagination, sort.

**Student role**: restricted to own `studentId`.

### `GET /payments/receipts/:paymentId`

Receipt payload: `payment`, `invoice`, `student` summary. Students may only load their own payments.

### `DELETE /payments/payments/:paymentId`

Void payment (`payment.delete`); reverses applied amount on the invoice and recalculates status. Not allowed after refunds on that payment.

### `POST /payments/refunds`

Requires `payment.refund`. Body: `paymentId`, `amount`, optional `reason`, `notes`. Updates payment, invoice paid/refund totals, and invoice status.

## Student payment history

### `GET /payments/students/:studentId/history`

Requires `payment.read`. Returns `student`, recent `invoices`, and `payments`.

**Student role**: `studentId` must be the caller’s own linked student id.

## Summary

### `GET /payments/summary`

Requires `payment.summary`. Query: `from`, `to`, `granularity` (`day` | `month`), optional `branchId` / `libraryId`. Returns time series and per-branch totals of collected payments.

## Student self-service (Students module)

### `GET /students/me/payments`

**Student role only.** Wallet-style payload: outstanding total, `totalPaid`, and embedded `invoices` / `payments` lists for the logged-in student. Does not require `payment.read`.
