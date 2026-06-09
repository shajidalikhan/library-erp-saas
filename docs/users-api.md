# Users & staff provisioning API

> Module: `backend/src/modules/users`  
> Base path: `/users` (mounted under `/api/v1`)

Tenant rules are enforced in `users.service.ts` (not only in the UI).

## Permissions

| Action | Permission gate |
|--------|-----------------|
| List / get | `user.read` **or** `staff.read` |
| Create | `user.create` **or** `staff.create` |
| Update | `user.update` **or** `staff.update` |
| Deactivate | `user.delete` **or** `staff.delete` |

`SUPER_ADMIN` bypasses permission checks in middleware but payloads are still validated.

## Create user — `POST /users`

**SUPER_ADMIN** (`user.create`):

- May create: `SUPER_ADMIN`, `LIBRARY_OWNER`, `MANAGER`, `RECEPTIONIST`, `ACCOUNTANT`, `SECURITY`.
- **`SUPER_ADMIN` role:** do not send `libraryId` or `branchId` (must be omitted or empty).
- **`LIBRARY_OWNER` role:** `libraryId` **required**; `branchId` must be omitted.
- **Staff roles (`MANAGER` … `SECURITY`):** `libraryId` **and** `branchId` **required**; the branch must belong to that library.
- **Student logins** are not created here — use the Students module.

**LIBRARY_OWNER** (`staff.create`):

- May create: `MANAGER`, `RECEPTIONIST`, `ACCOUNTANT`, `SECURITY` only.
- Send your tenant `libraryId` (and `branchId` for staff); the branch must belong to that library.

```json
{
  "fullName": "Priya Sharma",
  "email": "priya@example.com",
  "phone": "+91 9876543210",
  "password": "TempPass1",
  "isActive": true,
  "role": "RECEPTIONIST",
  "libraryId": "64b…",
  "branchId": "64c…"
}
```

## List users — `GET /users`

Supports pagination (`page`, `limit`), `search`, optional `libraryId` / `branchId` (SUPER_ADMIN), `includeInactive`.

## Get / update / deactivate

- `GET /users/:userId`
- `PATCH /users/:userId` — partial update; optional new `password`.
- `DELETE /users/:userId` — sets `isActive: false` (soft deactivate). Cannot target yourself.

After deploying new permissions, run `npm run seed:rbac` in `backend/`.
