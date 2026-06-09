# Demo Request Frontend

## Public

- Route: `/request-demo`
- Module: `frontend/src/modules/demo-requests`
- Form: checkbox cards for interested features, honeypot field, success screen
- API: `POST /demo-requests` via `demoRequestApi.create`

Landing page CTAs route to `/request-demo`. Public self-registration remains disabled.

## Super admin CRM

- Sidebar: **Platform → Demo Requests** (`/dashboard/platform/demo-requests`)
- Platform tabs also include **Demo requests**
- List: searchable table with status chips, full lead columns, and **View details**
- Detail: contact/library/requirements sections, timeline, internal notes, quick status actions
- Settings: **Platform → Settings** configures `demoRequestNotifyEmail`, `supportEmail`, and `salesEmail`

APIs: `platformApi.demoRequests`, `platformApi.demoRequest`, `platformApi.patchDemoRequest`, `platformApi.settings`, `platformApi.patchSettings`.
