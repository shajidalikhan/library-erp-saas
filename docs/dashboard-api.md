# Dashboard & search APIs

## Recent activity

| Method | Path | Access |
|--------|------|--------|
| `GET` | `/activity/recent` | Authenticated; tenant-scoped by role |
| `GET` | `/dashboard/recent-activity` | Alias of `/activity/recent` |

Query: `page`, `limit` (max 50).

Response items:

- `id`, `type`, `title`, `description`, `actorName`, `entityLabel`, `libraryName`, `branchName`, `createdAt`, `metadata`

Events are sourced from the platform audit log (student/seat/attendance/payment/notification/branch actions).

## Global search

| Method | Path | Access |
|--------|------|--------|
| `GET` | `/search?q=` | Authenticated; results filtered by RBAC and tenant |

Query: `q` (required, 1–120 chars), `limit` (optional, max 30).

Response: `{ items: [{ id, kind, title, subtitle, hrefPath, libraryName?, branchName? }] }`

Kinds include `library`, `branch`, `user`, `student`, `seat`, `invoice`, `payment`, `demo_request`, `notification`, `attendance` depending on role.
