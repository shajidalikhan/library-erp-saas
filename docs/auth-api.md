# Authentication & RBAC API

> Module: `backend/src/modules/auth`
> Base URL (dev): `http://localhost:5000/api/v1`
> Base path: `/auth`

---

## Table of Contents

1. [Overview](#overview)
2. [Auth Model](#auth-model)
3. [Roles & Permissions](#roles--permissions)
4. [Endpoints](#endpoints)
   - [User provisioning](#1-user-provisioning-no-public-register)
   - [Login](#2-login)
   - [Refresh Token](#3-refresh-token)
   - [Logout](#4-logout)
   - [Current User](#5-current-user)
   - [Forgot Password](#6-forgot-password)
   - [Reset Password](#7-reset-password)
5. [Standard Response Shapes](#standard-response-shapes)
6. [Error Codes](#error-codes)
7. [Testing Examples](#testing-examples)

---

## Overview

The platform uses **JWT-based authentication** with **HttpOnly cookies** by default and optional `Authorization: Bearer <token>` headers for non-browser clients (mobile / Postman / integrations).

Authorization is **permission-based** (not role-based). Every protected endpoint declares the permissions it needs via the `authorize(...)` middleware. The `SUPER_ADMIN` role bypasses permission checks.

Refresh tokens are **rotated** on every refresh, **hashed** before being stored in MongoDB, and capped per user (default = 5 active sessions).

---

## Auth Model

| Concept           | Where               | Notes                                                                 |
|-------------------|---------------------|-----------------------------------------------------------------------|
| Access token      | `Authorization` hdr + `access_token` cookie  | Short-lived (default 15m).                              |
| Refresh token     | `refresh_token` cookie (HttpOnly)            | Long-lived (default 7d). Rotated on every refresh.      |
| User              | `users` collection                            | Stores hashed password + per-session refresh-token hashes.|
| Role              | `roles` collection                            | References `permissions[]`.                              |
| Permission        | `permissions` collection                      | Format: `<resource>.<action>` (e.g. `student.create`).   |

### Cookies

| Cookie          | HttpOnly | Secure (prod) | SameSite | Lifetime           |
|-----------------|----------|---------------|----------|--------------------|
| `access_token`  | ✓        | ✓             | lax      | `JWT_ACCESS_EXPIRES_IN`  |
| `refresh_token` | ✓        | ✓             | lax      | `JWT_REFRESH_EXPIRES_IN` |

---

## Roles & Permissions

### System Roles

| Role            | Description                                       |
|-----------------|---------------------------------------------------|
| `SUPER_ADMIN`   | Platform owner. Cross-tenant. Has all permissions.|
| `LIBRARY_OWNER` | Tenant owner. Full access inside their library.   |
| `MANAGER`       | Branch-level manager.                              |
| `RECEPTIONIST`  | Front-desk staff.                                  |
| `ACCOUNTANT`    | Finance / payments staff.                          |
| `SECURITY`      | Physical security / attendance check-ins.          |
| `STUDENT`       | End user.                                          |

### Permission Catalog

All permissions are seeded from `backend/src/constants/permissions.constants.ts`.

| Group         | Permission              |
|---------------|-------------------------|
| user          | `user.read`, `user.create`, `user.update`, `user.delete`, `user.invite` |
| staff         | `staff.read`, `staff.create`, `staff.update`, `staff.delete` |
| role          | `role.read`, `role.manage` |
| library       | `library.read`, `library.create`, `library.update`, `library.delete` |
| branch        | `branch.read`, `branch.create`, `branch.update`, `branch.delete` |
| student       | `student.read`, `student.create`, `student.update`, `student.delete` |
| seat          | `seat.read`, `seat.create`, `seat.update`, `seat.delete`, `seat.assign` |
| attendance    | `attendance.read`, `attendance.create`, `attendance.update` |
| payment       | `payment.read`, `payment.create`, `payment.update`, `payment.delete` |
| report        | `report.view` |
| analytics     | `analytics.view` |
| notification  | `notification.read`, `notification.send` |

> Run `npm run seed:rbac` (inside `backend/`) once to seed system roles + permissions into MongoDB.

---

## Endpoints

> All requests/responses below use `Content-Type: application/json`.

---

### 1. User provisioning (no public register)

Public self-registration (`POST /auth/register`) is **disabled** for this professional ERP.

- **SUPER_ADMIN** provisions any system role using `POST /users` with `user.create` (see [users-api.md](./users-api.md)).
- **LIBRARY_OWNER** provisions staff and student **login accounts** in their tenant using `POST /users` with `staff.create`.

All new users receive a **temporary password** and should change it after first sign-in.

---

### 2. Login

`POST /auth/login`

**Rate-limited:** yes (auth limiter).

**Request body**

```json
{
  "email": "rohit@example.com",
  "password": "Secret123"
}
```

**Response (200)** — returns `user` and `tokens` (same envelope as historical register responses).

Failure returns `401 Unauthorized` with a generic message regardless of whether the email existed (anti-enumeration).

---

### 3. Refresh Token

`POST /auth/refresh`

Rotates the refresh token. Accepts the refresh token either from the `refresh_token` cookie or from the body.

**Rate-limited:** yes (auth limiter).

**Request body (optional, if cookie not used)**

```json
{ "refreshToken": "<existing-refresh-jwt>" }
```

**Response (200)** — same shape as `Login`. New cookies are set; the old refresh token is revoked on the server.

Reuse of an already-revoked refresh token clears ALL sessions for that user and returns `401`.

---

### 4. Logout

`POST /auth/logout`

**Auth:** required.

**Request body (optional)**

```json
{ "allDevices": false }
```

Pass `allDevices: true` to revoke every refresh token for the user.

**Response (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out",
  "data": null
}
```

Auth cookies are cleared on success.

---

### 5. Current User

`GET /auth/me`

**Auth:** required.

**Response (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Current user",
  "data": {
    "user": {
      "id": "665f01a...",
      "fullName": "Rohit Kumar",
      "email": "rohit@example.com",
      "role": "LIBRARY_OWNER",
      "permissions": ["user.read", "user.create", "..."],
      "libraryId": null,
      "branchId": null,
      "isActive": true,
      "isEmailVerified": false,
      "lastLoginAt": "2026-05-11T13:45:00.000Z",
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
```

---

### 6. Forgot Password

`POST /auth/forgot-password`

**Rate-limited:** yes (auth limiter).

**Request body**

```json
{ "email": "rohit@example.com" }
```

**Response (200)** — always returns the same message (anti-enumeration):

```json
{
  "success": true,
  "statusCode": 200,
  "message": "If an account exists, reset instructions have been sent.",
  "data": null
}
```

When SMTP is not configured in development, the reset URL is logged to the server console instead of being emailed.

---

### 7. Reset Password

`POST /auth/reset-password`

**Rate-limited:** yes (auth limiter).

**Request body**

```json
{
  "token": "<token-from-email-link>",
  "password": "NewSecret123"
}
```

Password rules match admin provisioning (min 8 chars, upper, lower, number).

**Response (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password reset successful. Please sign in with your new password.",
  "data": null
}
```

Invalid or expired tokens return `400` with `Invalid or expired reset token`. Successful resets clear all stored refresh sessions for the user.

---

## Standard Response Shapes

### Success

```json
{
  "success": true,
  "statusCode": 200,
  "message": "OK",
  "data": { },
  "meta": { }
}
```

### Error

```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid email or password",
  "details": { }
}
```

`stack` is included only in non-production environments.

---

## Error Codes

| HTTP | code                     | Typical cause                                  |
|------|--------------------------|------------------------------------------------|
| 400  | `BAD_REQUEST`            | Malformed payload / invalid IDs                 |
| 401  | `UNAUTHORIZED`           | Missing / invalid / expired token / bad login   |
| 403  | `FORBIDDEN`              | Missing permission, disabled user, wrong role   |
| 404  | `NOT_FOUND`              | Route or resource not found                     |
| 409  | `CONFLICT`               | Duplicate email or other unique-constraint hit  |
| 422  | `UNPROCESSABLE_ENTITY`   | Zod validation failure (`details.fieldErrors`)  |
| 429  | `TOO_MANY_REQUESTS`      | Rate limit hit                                  |
| 500  | `INTERNAL_SERVER_ERROR`  | Unhandled / unexpected failure                  |

---

## Testing Examples

### cURL

```bash
# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{ "email": "rohit@example.com", "password": "Secret123" }'

# Current user (cookie auth)
curl http://localhost:5000/api/v1/auth/me -b cookies.txt

# Current user (bearer token)
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer <access_token>"

# Refresh
curl -X POST http://localhost:5000/api/v1/auth/refresh \
  -b cookies.txt -c cookies.txt

# Logout (current device)
curl -X POST http://localhost:5000/api/v1/auth/logout \
  -b cookies.txt -c cookies.txt \
  -H "Content-Type: application/json" \
  -d '{ "allDevices": false }'
```

### Node (axios)

```ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
  withCredentials: true, // send/receive cookies
});

// Login
const { data } = await api.post('/auth/login', {
  email: 'rohit@example.com',
  password: 'Secret123',
});

// Use bearer token for subsequent requests if you don't rely on cookies
api.defaults.headers.common.Authorization = `Bearer ${data.data.tokens.accessToken}`;
const me = await api.get('/auth/me');
```

### Postman

A ready-to-import collection is available at:

`docs/postman/Library-ERP.postman_collection.json`

Import it into Postman, then:

1. Set the `baseUrl` environment variable to `http://localhost:5000/api/v1`.
2. Run `Auth / Login` — the test script will automatically capture `accessToken` and `refreshToken` into environment variables.
3. Subsequent protected requests use `{{accessToken}}` as a Bearer token.

---

## Development

```bash
# 1. Configure env
cp backend/.env.example backend/.env

# 2. Install deps (already done if you bootstrapped from this repo)
cd backend && npm install

# 3. Seed roles + permissions
npm run seed:rbac

# 4. Start dev server (watch mode)
npm run dev

# 5. Production build + start
npm run build && npm start
```
