# Demo Request API

> Module: `backend/src/modules/demo-requests`
> Base URL (dev): `http://localhost:5000/api/v1`

## Public

### Create demo request

`POST /demo-requests`

**Auth:** none (rate-limited)

**Body**

```json
{
  "fullName": "Rohit Kumar",
  "email": "owner@example.com",
  "phone": "+91 98765 43210",
  "libraryName": "City Study Hub",
  "city": "Jaipur",
  "branchCount": 2,
  "studentCount": 250,
  "currentSystem": "Excel",
  "interestedFeatures": ["ATTENDANCE", "PAYMENTS"],
  "notes": "Need onboarding next week",
  "website": ""
}
```

`website` is a honeypot field and must remain empty.

**Response (201)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Thanks! Our team will contact you shortly.",
  "data": { "id": "665f01a..." }
}
```

## Super admin (platform)

Mounted under `/platform/demo-requests` with `authenticate` + `requireSuperAdmin`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/platform/demo-requests` | Paginated lead inbox (search, status, assignee filters) |
| GET | `/platform/demo-requests/:requestId` | Lead detail with timeline and notes |
| PATCH | `/platform/demo-requests/:requestId` | Update status, assign owner, append notes |

Status values: `NEW`, `CONTACTED`, `DEMO_SCHEDULED`, `CONVERTED`, `REJECTED`.

New submissions append a platform audit log entry (`DEMO_REQUEST_CREATED`), send an email to the configured demo notification recipient, and create an in-app `SYSTEM` notification for every active `SUPER_ADMIN` user.

### Notification email recipient

Resolved in order:

1. `demoRequestNotifyEmail` from `/platform/settings`
2. `salesEmail` from `/platform/settings`
3. `SMTP_FROM`
4. `SMTP_USER`

If SMTP is not configured in development, the full notification email content is logged to the server terminal.

Email subject: `New demo request - {{libraryName}}`.

### Lead fields returned to Super Admin

`fullName`, `email`, `phone`, `libraryName`, `city`, `branchCount`, `studentCount`, `currentSystem`, `interestedFeatures`, `notes`, `status`, `assignedTo`, `statusHistory`, `adminNotes`, `createdAt`, `updatedAt`.
