# Super Admin bootstrap

This document describes how to create the first **platform super admin** user for the Library ERP backend using the idempotent bootstrap script.

## Prerequisites

1. **Environment** — Configure MongoDB in `backend/.env` (same variables as the API server):

   - `MONGODB_URI`
   - `MONGODB_DB_NAME` (if used by your deployment)

2. **RBAC seed** — System roles (including `SUPER_ADMIN`) must exist before creating the user:

   ```bash
   cd backend
   npm run seed:rbac
   ```

## Run the bootstrap

From the `backend` directory:

```bash
npm run create:superadmin
```

The script:

- Connects to MongoDB using the shared `connectDB` helper.
- Loads the **SUPER_ADMIN** system role (`isSystem: true`, `libraryId: null`).
- If a user with the bootstrap email already exists **and** is already a tenant-less super admin, it **skips** creation and exits successfully.
- If that email exists with **another** role, it **aborts** (no overwrite).
- Otherwise creates the user with a **bcrypt** hash from `UserModel.hashPassword` (same path as normal registration).

## Default credentials (development)

| Field     | Value                 |
|----------|------------------------|
| Full name | `Super Admin`        |
| Email    | `admin@libraryerp.com` |
| Password | `Admin123`           |
| Role     | `SUPER_ADMIN`        |

**Production:** treat the default password as **temporary**. Change it on first login, enforce MFA if your product adds it, and restrict who can run this script in CI/CD or server shells.

## Troubleshooting

| Message | Action |
|--------|--------|
| `SUPER_ADMIN system role not found` | Run `npm run seed:rbac`. |
| `A user with email ... already exists with role` | Use another email or adjust the existing user in the database; the script will not overwrite. |
| Connection errors | Verify `MONGODB_URI` and network access to Atlas (or local MongoDB). |

## Implementation reference

- Script: `backend/src/scripts/create-super-admin.ts`
- NPM script: `create:superadmin` in `backend/package.json`
- Models: `UserModel`, `RoleModel` from `@modules/auth/auth.models`
- Password hashing: `UserModel.hashPassword` (`bcryptjs`, rounds from `ENV.BCRYPT_SALT_ROUNDS`)
