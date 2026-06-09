# Library & Branch Management API

Base path: `{API_PREFIX}` (default `/api/v1`). All routes require a valid access token unless noted.

## Permissions

| Permission       | Typical roles                          |
| ---------------- | -------------------------------------- |
| `library.create` | `SUPER_ADMIN`                          |
| `library.read`   | `SUPER_ADMIN`, `LIBRARY_OWNER`, `MANAGER`, … |
| `library.update` | `SUPER_ADMIN`, `LIBRARY_OWNER`         |
| `library.delete` | `SUPER_ADMIN`                          |
| `branch.create`  | `SUPER_ADMIN`, `LIBRARY_OWNER`         |
| `branch.read`    | `SUPER_ADMIN`, `LIBRARY_OWNER`, `MANAGER`, … |
| `branch.update`  | `SUPER_ADMIN`, `LIBRARY_OWNER`, `MANAGER` (own branch) |
| `branch.delete`  | `SUPER_ADMIN`, `LIBRARY_OWNER`         |

`SUPER_ADMIN` bypasses permission checks in middleware but still hits tenant guards where applicable.

## Multi-tenant rules

- **Libraries** are tenant roots. `LIBRARY_OWNER` and staff users carry `libraryId` (and optionally `branchId`) on their JWT / session after onboarding.
- **List libraries**: `SUPER_ADMIN` sees all libraries; other roles with `library.read` only see the library matching their `libraryId`.
- **Branches** always belong to a `libraryId`. Managers are scoped to **their** `branchId` for read/update and cannot create or delete branches.

## Libraries

### `GET /libraries`

List libraries with pagination, search, filters, and sorting.

**Query**

| Field               | Type   | Notes |
| ------------------- | ------ | ----- |
| `page`              | number | default `1` |
| `limit`             | number | default `20`, max `100` |
| `search`            | string | matches name, slug, email, city (regex) |
| `sortBy`            | enum   | `createdAt`, `name`, `status`, `slug` |
| `sortOrder`         | enum   | `asc`, `desc` |
| `status`            | enum   | `ACTIVE`, `TRIAL`, `SUSPENDED` |
| `country`           | string | exact match (case-insensitive) |
| `subscriptionPlan` | enum  | `FREE`, `STARTER`, `GROWTH`, `ENTERPRISE` |

**Response** `200`

```json
{
  "success": true,
  "data": { "items": [/* Library documents */] },
  "meta": { "pagination": { "total", "page", "limit", "totalPages", "hasNext", "hasPrev" } }
}
```

### `POST /libraries`

Create a library. **Requires** `library.create` (intended for `SUPER_ADMIN`).

Body (subset): `name`, `email`, optional `slug`, `ownerId`, contact/address fields, `subscriptionPlan`, `status`, `settings`.

If `ownerId` is provided, the user must exist; their `libraryId` is set to the new library.

### `GET /libraries/:libraryId`

Fetch one library. Caller must belong to the tenant (or be `SUPER_ADMIN`).

### `PATCH /libraries/:libraryId`

Update library fields. `LIBRARY_OWNER` cannot change `slug` or `ownerId`; `SUPER_ADMIN` can.

### `PATCH /libraries/:libraryId/settings`

Shallow-merge JSON into `library.settings`.

### `DELETE /libraries/:libraryId`

**Super admin only.** Fails with `400` if any branch still exists for the library.

## Branches

All branch routes live under `/libraries/:libraryId/branches`.

### `GET /libraries/:libraryId/branches`

Same pagination/search/sort pattern as libraries.

**Query highlights**

| Field    | Type   | Notes |
| -------- | ------ | ----- |
| `active` | string | `"true"` / `"false"` (coerced to boolean) |
| `sortBy` | enum   | `createdAt`, `branchName`, `branchCode`, `totalSeats` |

### `POST /libraries/:libraryId/branches`

Create a branch. **Not** available to `MANAGER` (service guard).

### `GET /libraries/:libraryId/branches/:branchId`

### `PATCH /libraries/:libraryId/branches/:branchId`

### `DELETE /libraries/:libraryId/branches/:branchId`

Managers cannot delete branches.

## Error contract

Validation issues return `422` with `{ success: false, code: "UNPROCESSABLE_ENTITY", details: Zod flatten }`.

Authorization failures return `403` with `{ success: false, code: "FORBIDDEN", message, details? }`.

## Postman

Import `docs/postman/Library-ERP.postman_collection.json` and the matching environment. The **Library & Branch** folder mirrors these endpoints.

## Tests

Backend Vitest coverage:

- `npm run test` — validation + RBAC helper tests under `src/modules/library/*.test.ts`.
