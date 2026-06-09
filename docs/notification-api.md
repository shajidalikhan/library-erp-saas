# Notifications API

Base path: `{{API_PREFIX}}/notifications` (e.g. `/api/v1/notifications`). All routes require authentication unless noted.

## Permissions

| Permission | Usage |
|------------|--------|
| `notification.read` | List inbox, unread count, mark read / read all |
| `notification.send` | `POST /send`, `POST /bulk-send`, `GET /notifications/recipients`, list templates (for compose) |
| `notification.manage` | List another user’s inbox via `recipientUserId`, `GET /logs` |
| `notification.template.manage` | Create / update / delete templates |

Role defaults are defined in `backend/src/constants/permissions.constants.ts`. After adding new permissions, re-run the auth seeder so tenant roles pick them up.

## Channels and delivery

- Every stored notification is **in-app** (`channel: IN_APP`) so it appears in the inbox.
- The requested channel (`IN_APP`, `EMAIL`, `SMS`, `WHATSAPP`) is copied into `metadata.requestedChannel`. Non–`IN_APP` channels invoke **stub** dispatchers only (no real email/SMS/WhatsApp).

## Endpoints

### `GET /notifications`

Query: pagination (`page`, `limit`), optional `libraryId` (super), `recipientUserId` (requires `notification.manage`), `type`, `status`, `unreadOnly=true|false`.

### `GET /notifications/unread-count`

Returns `{ count }` for the current user (tenant-scoped for non–super users).

### `PATCH /notifications/:notificationId/read`

Marks a single notification read for the **current user** only.

### `PATCH /notifications/read-all`

Marks all unread notifications for the current user.

### `POST /notifications/send`

Body: `title`, `message`, `type`, `channel` (optional, default `IN_APP`), optional `libraryId` / `branchId`, `templateId` + `templateVariables`, `target`, optional `includeSelf` (boolean, default **false**), optional `metadata`.

**`target.mode`**: `USER` | `ROLE` | `BRANCH` | `LIBRARY` | `STUDENTS_WITH_DUES` | `PLATFORM` (super admin only).

- **`includeSelf`**: When `false` (default), the authenticated sender’s user id is removed from the resolved recipient set for every mode **except** `USER` (explicit single-user sends still deliver to that user). Use `includeSelf: true` when the sender should also receive the same broadcast (e.g. test to self).
- **`PLATFORM`**: Resolves to all active users across libraries; only `SUPER_ADMIN` may use it. Sender is excluded by default unless `includeSelf` is true.
- **`LIBRARY`**: Library owner: all staff/students in the library (tenant-scoped). Sender excluded by default.
- **`BRANCH` / manager `LIBRARY` semantics**: Branch-scoped users for managers; sender excluded by default.

Business rules (enforced in service): accountants may only target `USER` or `STUDENTS_WITH_DUES`; receptionists may not use `LIBRARY`, `ROLE`, `PLATFORM`, or `STUDENTS_WITH_DUES`; managers are branch-scoped via recipient resolver; library owners cannot leave their library.

### `POST /notifications/bulk-send`

Body: `libraryId?`, `branchId?`, `items` (max 25) — each item matches the send payload (without per-item `libraryId`/`branchId`), including optional per-item `includeSelf`.

### `GET /notifications/recipients`

Requires `notification.send`. Tenant-scoped list for compose UI: search and pick users without typing MongoDB ids.

**Query:** `page`, `limit`, optional `q` (matches **fullName**, **email**, **phone**, and resolved **role** display name), optional `role` (one of `SEND_TARGET_ROLE_NAMES`: `SUPER_ADMIN`, `LIBRARY_OWNER`, `MANAGER`, … — filters users with that role in the tenant), optional `branchId` (library owners may narrow to a branch; managers are always scoped to their branch server-side), optional `libraryId` (**required** for `SUPER_ADMIN`).

**Each item:** `userId`, `fullName`, `email`, `phone`, `role` (role display name), `branchName`, `libraryName`.

### Templates

- `GET /notifications/templates` — pagination + optional `libraryId`, `active`.
- `POST /notifications/templates` — tenant-scoped; super may set `libraryId` or omit for global templates.
- `PATCH /notifications/templates/:templateId`
- `DELETE /notifications/templates/:templateId`

### `GET /notifications/logs`

Requires `notification.manage`. Owners see library-wide logs; managers are limited to their branch.

### `GET /notifications/logs/:logId`

Requires `notification.manage`. Returns a **detail** payload for one log entry:

- `title`, `message`, `type`, `audience` (target snapshot), `includeSelf`
- `recipients[]` (`userId`, `fullName`, `email`, `role`, `branchName`, `libraryName`)
- `recipientNames`, `recipientCount`, `statusBreakdown` (`SENT` / `FAILED` / `PENDING`)
- `createdBy` (`id`, `fullName`, `email`), `createdAt`, `action`, `channel`
- `legacy: true` when the row predates stored message snapshots (title falls back to summary; `message` may be null).

## Scheduled jobs

When `NOTIFICATION_JOBS_ENABLED=true`, the server registers a daily cron sweep (09:10 local server time) for:

- invoices due in **3 days** (`PAYMENT_DUE`),
- **overdue** / unpaid past due (`PAYMENT_OVERDUE`),
- **membership** ending in **7 days** (`MEMBERSHIP_EXPIRY`).

Jobs are **disabled by default**; set the env var explicitly in production when ready.

## Models

- **Notification** — tenant + recipient + type + status + `readAt` / `sentAt` + `metadata` + `createdBy`.
- **NotificationTemplate** — tenant-scoped template with `variables` for `{{placeholder}}` replacement.
- **NotificationLog** — audit rows for `SEND`, `BULK_SEND`, and `CRON`. New sends persist `metadata.snapshot` (title, message, audience, recipients, status breakdown) for the log detail API.
