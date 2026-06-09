# Platform (SaaS control) API

Base path: `{{API_PREFIX}}/platform`. **All routes require authentication and the `SUPER_ADMIN` role.**

New permissions (assigned automatically to `SUPER_ADMIN` via the global catalog):

- `platform.manage`
- `audit.read`
- `subscription.manage`
- `impersonation.manage` (reserved)

After deploying new permissions, run the auth/RBAC seeder so JWT `me` payloads include the strings if you rely on them client-side.

## Tenant suspension

When a library `status` is `SUSPENDED` (or `suspendedAt` is set), **tenant-bound users cannot log in or call authenticated APIs** (`403` with `code: TENANT_SUSPENDED` and `details: { suspensionReason, libraryName }`).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/platform/dashboard` | Totals: libraries, students, monthly revenue, active users (30d), trials expiring (7d). |
| GET | `/platform/health` | Process memory, Mongo connectivity flag, uptime. |
| GET | `/platform/settings` | Singleton platform settings (`supportEmail`, `salesEmail`, `demoRequestNotifyEmail`, maintenance, feature flags, impersonation notes). |
| PATCH | `/platform/settings` | Partial update of settings. |
| GET | `/platform/tenants` | Paginated tenant list: `search`, `status`, `subscriptionPlan`, `sortBy`, `sortOrder`. |
| GET | `/platform/tenants/:libraryId` | Library profile + usage counts (branches, students, seats, staff, invoices, payments 30d). |
| PATCH | `/platform/tenants/:libraryId` | Update `subscriptionPlan`, `subscriptionStatus`, `trialEndsAt`, `status`. |
| PATCH | `/platform/tenants/:libraryId/suspend` | Body `{ reason }` — sets `SUSPENDED`, notifies owner. |
| PATCH | `/platform/tenants/:libraryId/activate` | Clears suspension fields, sets `ACTIVE`. |
| GET | `/platform/subscriptions/plans` | Lists catalog plans (auto-seeds defaults if empty). |
| POST | `/platform/subscriptions/plans` | Creates a plan row (`planKey` unique). |
| PATCH | `/platform/subscriptions/plans/:planId` | Updates limits/pricing/flags. |
| GET | `/platform/audit-logs` | Paginated immutable audit trail (`action`, `entityType`, `libraryId`, `actorUserId`, `from`/`to`, `q`). |
| GET | `/platform/usage` | Top libraries by students, payment trend (30d), new libraries by month. |
| POST | `/platform/usage/snapshots` | Writes `TenantUsageSnapshot` per library (heavy; run on a schedule or manually). |
| POST | `/platform/announcements` | Body `{ title, message, type? }` — platform-wide in-app send (`PLATFORM` audience). |
| GET | `/platform/demo-requests` | Paginated demo lead inbox (`search`, `status`, `assignedTo`, sorting). |
| GET | `/platform/demo-requests/:requestId` | Demo lead detail with timeline and internal notes. |
| PATCH | `/platform/demo-requests/:requestId` | Update status, assign owner, append internal notes. |
| GET | `/platform/impersonation/policy` | Placeholder JSON describing future impersonation design. |

## Subscription plan `featureFlags`

`POST` and `PATCH` accept an optional `featureFlags` object: **string keys → boolean values**. Only the catalog keys below are allowed; requests with any other key are rejected with validation error.

| Key | Meaning (product) |
|-----|-------------------|
| `multi_branch` | Multiple branches per library. |
| `advanced_analytics` | Extended analytics dashboards. |
| `reports_export` | CSV / PDF / Excel report exports. |
| `notifications` | In-app notifications. |
| `whatsapp_notifications` | WhatsApp alerts. |
| `sms_notifications` | SMS alerts. |
| `email_notifications` | Email alerts / digests. |
| `student_portal` | Student self-serve portal. |
| `attendance_qr` | QR-based attendance. |
| `payment_reminders` | Automated payment reminders. |
| `custom_roles` | Extended RBAC. |
| `audit_logs` | Audit log access for tenant admins. |
| `api_access` | API / automation access. |
| `white_label` | White-label branding. |
| `priority_support` | Priority support tier. |

Example body fragment:

```json
"featureFlags": {
  "multi_branch": true,
  "advanced_analytics": true,
  "reports_export": false
}
```

The admin UI manages these as toggles; saving a plan replaces `featureFlags` with the submitted object (catalog keys only—legacy keys are dropped if present).

## Models (platform module)

- **AuditLog** — append-only security / admin events.
- **PlatformSetting** — singleton (`singletonKey: default`).
- **PlatformSubscriptionPlan** — SaaS tier catalog (limits + pricing).
- **TenantUsageSnapshot** — historical per-tenant rollups.

## Library billing fields

Libraries additionally store:

- `trialEndsAt`, `subscriptionStatus` (`TRIALING` | `ACTIVE` | `PAST_DUE` | `CANCELLED`)
- `suspendedAt`, `suspensionReason`

New trial libraries receive a default `trialEndsAt` (+14 days) on first save when `status` is `TRIAL`.

## Cron

When `NOTIFICATION_JOBS_ENABLED=true`, the daily notifications job also nudges **owners** whose `trialEndsAt` falls in the 7-day window (deduped via `settings` flags).

## Impersonation

Not implemented. Middleware placeholder `impersonationContextPlaceholder` is registered ahead of platform routes for future `X-Impersonation-Context` handling.
