# Notifications frontend

## Routes

| Path | Purpose |
|------|---------|
| `/dashboard/notifications` | Inbox (filters, mark all read) |
| `/dashboard/notifications/[id]` | Detail + mark read |
| `/dashboard/notifications/send` | Compose: audience modes, `NotificationRecipientSelect`, `BranchSelect`, optional template autofill, `includeSelf` |
| `/dashboard/notifications/templates` | Create templates; list with **Edit** (modal) and **Delete** (confirm) |
| `/dashboard/notifications/logs` | Audit log table with **View** → detail |
| `/dashboard/notifications/logs/[logId]` | Log detail: message snapshot, recipients, status breakdown (`notification.manage`) |

Constants live in `frontend/src/constants/routes.ts` (`ROUTES.NOTIFICATIONS_*`, `notificationDetailRoute`, `notificationLogDetailRoute`).

## Module

`frontend/src/modules/notifications/`:

- `types.ts` — mirrors backend enums for UI selects.
- `notifications.service.ts` — Axios wrappers via `request` / `requestDataAndMeta`.
- `notifications-query-keys.ts` — React Query keys (includes `recipients`, `logDetail`).
- `components/selectors/notification-recipient-select.tsx` — debounced `GET /notifications/recipients` combobox (no raw user ids).

## Navbar bell

`NotificationMenu` (`frontend/src/components/layout/notification-menu.tsx`) loads:

- unread count (`GET /notifications/unread-count`),
- latest five rows (`GET /notifications?limit=5`),

and marks an item read when opened from the dropdown. Students also get a **Notifications** item in the student sidebar when they have `notification.read`.

Broadcast sends use **`includeSelf: false`** by default on the API, so library-wide or platform **ALL** notifications do not create an inbox row for the sender unless they opt in — the bell reflects only rows stored for the current user.

## Permissions UI

Mirror strings in `frontend/src/constants/permissions.ts` with the backend catalog. Sidebar **Insights → Notifications** uses `notification.read`. Sub-navigation shows **Send**, **Templates**, and **Logs** only when the user has the matching permission.

## Environment (backend)

Reminder cron is controlled only on the API: `NOTIFICATION_JOBS_ENABLED=true|false` in the backend `.env` (see `backend/.env.example`).
