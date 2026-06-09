# Student API

Base path: `/api/v1/students`

## List students

`GET /students`

Supports pagination, search, sorting, and membership filters.

| Query | Description |
|-------|-------------|
| `page`, `limit` | Pagination |
| `search` | Name, student id, email, phone |
| `status` | `ACTIVE`, `INACTIVE`, `SUSPENDED` |
| `branchId` | Branch filter (tenant-scoped) |
| `libraryId` | Super admin library filter |
| `shiftId` | Students with active seat assignment on shift |
| `membershipStatus` | `ACTIVE`, `SUSPENDED`, `EXPIRED` |
| `expiringIn` | `1-3` or `4-7` (calendar days from today) |
| `membershipEndFrom`, `membershipEndTo` | End date range |

### Membership filter definitions

| Filter | Rule |
|--------|------|
| `ACTIVE` | `membershipEndDate >= start of today` and `status = ACTIVE` |
| `SUSPENDED` / `EXPIRED` | `membershipEndDate < start of today` OR `status = SUSPENDED` |
| `expiringIn=1-3` | End date from tomorrow through end of today+3, `status = ACTIVE` |
| `expiringIn=4-7` | End date from start of today+4 through end of today+7, `status = ACTIVE` |

Dashboard membership counts use the same rules via `GET /memberships/dashboard`.

## Admit student (workflow)

`POST /students/admission`

`multipart/form-data` recommended when uploading `profilePhoto` / `documentProof`.

Nested objects are sent as JSON strings:

| Form field | Content |
|------------|---------|
| `membership` | `{ "enabled": true, "shiftId", "feePlanId", "startDate", "endDate?", "amountOverride?" }` |
| `seatAssignment` | `{ "enabled": true, "seatId", "shiftId" }` |
| `payment` | `{ "enabled": true, "paidAmount", "method", "transactionId?", "notes?" }` |

All other student identity fields match `POST /students` (without legacy `membershipStartDate` / `membershipEndDate` on the root body).

Permissions:

- `student.create` — required
- `membership.create` — when `membership.enabled`
- `seat.assign` — when `seatAssignment.enabled`
- `payment.create` — when membership creates an invoice or payment is collected
- `membership.update` — manual `membership.endDate`
- `payment.update` — `membership.amountOverride` when plan allows override

Response:

```json
{
  "student": {},
  "membership": null,
  "seatAssignment": null,
  "invoice": null,
  "payment": null,
  "receipt": null
}
```

## Create student

`POST /students`

JSON body or `multipart/form-data` when uploading files.

| Field | Type |
|-------|------|
| `profilePhoto` | File (JPG/PNG/WEBP, max 1MB) |
| `documentProof` | File (JPG/PNG/WEBP/PDF, max 2MB) |

Stored in MongoDB as:

```json
{
  "profilePhoto": { "url": "...", "publicId": "..." },
  "documentProof": { "url": "...", "publicId": "...", "fileType": "image/webp" }
}
```

## Update student

`PATCH /students/:studentId`

Same multipart fields as create. Replacing a file deletes the previous Cloudinary asset.

## ID card

`GET /students/:studentId/id-card`

Returns `application/pdf` with library/branch branding, student photo, membership dates, QR code, and emergency contact. No MongoDB ObjectIds are included in the PDF.

Requires `idCard.generate` or `student.read` permission and tenant access to the student.
