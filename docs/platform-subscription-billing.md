# Platform subscription billing

SaaS subscription invoicing for libraries is separate from **student fee payments** (`/payments`). It is scoped to platform plans and library tenant lifecycle.

## Data model

- **Collection:** `PlatformSubscriptionInvoice`
- **Key fields:** `libraryId`, `planId`, `planCode`, `planName`, `billingCycle` (`MONTHLY` | `YEARLY` | `CUSTOM`), `invoiceNumber` (unique), monetary fields, lifecycle dates, `status` (`UNPAID` | `PARTIAL` | `PAID` | `OVERDUE` | `CANCELLED`), audit fields.

## APIs

### Super admin (`authenticate` + `requireSuperAdmin`, prefix `/platform`)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/platform/subscription-invoices` | Create invoice (optional partial pay on create). |
| `GET` | `/platform/subscription-invoices` | List + search + filters (`libraryId`, `status`, pagination, sort). |
| `GET` | `/platform/subscription-invoices/:invoiceId` | Detail (+ `libraryName`). |
| `POST` | `/platform/subscription-invoices/:invoiceId/collect` | Record partial/full collection. |
| `PATCH` | `/platform/subscription-invoices/:invoiceId/cancel` | Cancel open invoice. |

### Library owner (`authenticate` + `requireRole(LIBRARY_OWNER)`, prefix `/billing`)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/billing/subscription` | Current plan, dates, usage, open due total, feature flags, support contacts. |
| `GET` | `/billing/subscription/invoices` | Paginated invoices for the owner’s library only. |
| `GET` | `/billing/subscription/invoices/:invoiceId` | Single invoice (403 if not this library). |

### Tenant detail enrichment

`GET /platform/tenants/:libraryId` includes **`billingSnapshot`** (same shape as owner subscription payload) for super-admin UI and subscription badge modals.

## Business rules

- On create: library and active plan must exist; period from `billingCycle` (CUSTOM requires `subscriptionEndDate`); default `amount` from plan prices unless overridden; `dueAmount = amount - paidAmount`; status from amount, paid portion, and due date.
- When an invoice reaches **PAID** (on create or after collection), the library is **renewed**: `subscriptionPlan` from invoice, `subscriptionStatus` / `status` **ACTIVE**, `subscriptionEndsAt` set from invoice period, suspension fields cleared.
- **Partial** collections are allowed; **PAID** activation only when fully settled.
- **Overdue:** open items with `dueDate` in the past and `dueAmount > 0` are moved to `OVERDUE` by the daily job (`markOverdueInvoices`).
- **Grace suspend:** libraries that are **ACTIVE** with **ACTIVE** subscription status and `subscriptionEndsAt` more than **2 days** ago are suspended (`suspendLibrariesPastSubscriptionGrace`).

## Notifications & email

- **Create / collect:** in-app notification to the library owner; email via existing `sendEmail` when SMTP is configured (failures are logged, not fatal).
- **Reminders:** cron can flag “due in 3 days” subscription invoices once per invoice per day (stored on `library.settings`).

## Cron (`notifications.jobs`)

Order (after trial auto-suspend, before student payment sweep):

1. `markOverdueInvoices`
2. `remindSubscriptionInvoicesDueSoon`
3. `suspendLibrariesPastSubscriptionGrace`

Existing **trial** suspension and student **payment due / overdue** jobs are unchanged.

## Frontend

- **Owner:** `/dashboard/billing`
- **Super admin:** `/dashboard/platform/subscriptions/invoices`
- **Subscription badge:** clickable plan tag opens a modal with plan, billing summary, usage, features, support, and role-specific quick actions (tenant page uses `billingSnapshot` from the tenant API when available).

## Tests

See `backend/src/modules/subscription-billing/subscription-billing.integration.test.ts` (create, partial pay, full pay reactivation, overdue sweep, owner isolation).
