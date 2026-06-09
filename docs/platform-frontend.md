# Platform (SaaS control) frontend

## Access

The UI is shown only to **`SUPER_ADMIN`** users (sidebar **Platform → SaaS control** requires `platform.manage`, which only the super role receives in the default catalog).

Routes (see `frontend/src/constants/routes.ts`):

| Path | Purpose |
|------|---------|
| `/dashboard/platform` | KPI dashboard |
| `/dashboard/platform/tenants` | Searchable tenant table |
| `/dashboard/platform/tenants/[libraryId]` | Detail, suspend / activate |
| `/dashboard/platform/subscriptions/plans` | Plan catalog (pricing, limits, **feature toggles** for the catalog keys in `platform-api.md`) |
| `/dashboard/platform/usage` | Charts + snapshot trigger |
| `/dashboard/platform/audit-logs` | Audit table |
| `/dashboard/platform/settings` | Support, sales, and demo notification emails + maintenance toggle |
| `/dashboard/platform/announcements` | Global announcement composer |
| `/dashboard/platform/demo-requests` | Demo lead inbox |
| `/dashboard/platform/demo-requests/[requestId]` | Lead detail, status actions, internal notes |

## Module

`frontend/src/modules/platform/`:

- `platform.service.ts` — Axios wrappers.
- `platform-query-keys.ts` — React Query keys.
- `components/platform-sub-nav.tsx` — horizontal tabs.

## Suspended tenant UX

- Login: `403` + `TENANT_SUSPENDED` redirects to `/tenant-suspended?reason=…&library=…` (`useAuth` + Axios interceptor).
- Authenticated session: any API returning the same error triggers a full redirect to the suspended page.
- `middleware.ts` allows `/tenant-suspended` even when session cookies exist so the message can render before signing out.

## Related backend docs

See `docs/platform-api.md` for payloads and RBAC notes.
