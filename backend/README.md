# Library ERP - Backend

Production-grade backend for the **Self Study Library ERP SaaS** platform.

- Stack: **Node.js + Express.js + TypeScript + MongoDB (Mongoose)**
- Architecture: **feature-based modules** under `src/modules/<feature>`
- Auth: **JWT (access + refresh) with HttpOnly cookies**
- Authorization: **Permission-based RBAC**
- Validation: **Zod**
- Security: **helmet, cors, express-rate-limit, cookie-parser, bcrypt**

---

## Folder Structure

```text
backend/
  src/
    app.ts                     # Express app factory (middleware, routes, errors)
    server.ts                  # HTTP bootstrap + graceful shutdown

    config/
      env.config.ts            # Zod-validated environment loader
      db.ts                    # Mongoose connection helper
      jwt.config.ts            # JWT sign/verify helpers
      index.ts

    constants/
      http.constants.ts        # HTTP status codes, cookie names
      roles.constants.ts       # System role enum
      permissions.constants.ts # Permission catalog + role→permission map
      index.ts

    middlewares/
      auth.middleware.ts       # authenticate (JWT -> req.user)
      rbac.middleware.ts       # authorize / authorizeAny / requireRole
      validate.middleware.ts   # Zod request validator
      error.middleware.ts      # Centralized error handler
      notFound.middleware.ts   # 404 handler
      rateLimit.middleware.ts  # Global + auth rate limiters
      requestId.middleware.ts  # x-request-id correlation
      index.ts

    utils/
      ApiError.ts              # Custom error class with factories
      ApiResponse.ts           # Standardized success response helper
      asyncHandler.ts          # Async wrapper for controllers/middleware
      logger.ts                # Tiny console logger (swappable)
      pagination.ts            # resolvePagination / buildPaginationMeta
      cookies.ts               # setAuthCookies / clearAuthCookies
      index.ts

    modules/
      auth/
        user.model.ts          # User schema (passwordHash, refresh tokens)
        role.model.ts          # Role schema (links to permissions)
        permission.model.ts    # Permission schema
        auth.validation.ts     # Zod schemas (register/login/refresh/logout)
        auth.service.ts        # Business logic
        auth.controller.ts     # Thin HTTP handlers
        auth.routes.ts         # Express router
        auth.permissions.ts    # Module-local permission references
        auth.constants.ts      # Module-local constants
        auth.seeder.ts         # RBAC seeder (npm run seed:rbac)
        index.ts

    routes/
      index.ts                 # Aggregates all module routers

    types/
      express.d.ts             # Augments req.user
```

---

## Scripts

```bash
npm run dev          # tsx watcher on src/server.ts
npm run build        # Compiles to dist/ and rewrites path aliases (tsc-alias)
npm start            # Runs dist/server.js
npm run typecheck    # tsc --noEmit
npm run test         # vitest (validation + RBAC unit tests)
npm run seed:rbac    # Seed system roles + permissions into MongoDB
```

---

## Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

Required keys are validated at startup; bad/missing values exit the process with a clear error.

---

## Bootstrap Order

1. `npm install`
2. Fill in `.env`
3. `npm run seed:rbac` &nbsp; *(must run once before first login)*
4. `npm run dev`

API will be available at `http://localhost:5000/api/v1`.

---

## Adding a New Module

1. Create `src/modules/<feature>/` with the standard files:
   - `<feature>.routes.ts`
   - `<feature>.controller.ts`
   - `<feature>.service.ts`
   - `<feature>.validation.ts`
   - `<feature>.model.ts`
   - `<feature>.permissions.ts`
   - `<feature>.constants.ts`
   - `index.ts`
2. Add new permissions (if any) to `constants/permissions.constants.ts`.
3. Map them to roles in `ROLE_PERMISSIONS`.
4. Re-run `npm run seed:rbac` so new permissions/roles are applied.
5. Register the router in `src/routes/index.ts`.

---

## API Documentation

See [`docs/auth-api.md`](../docs/auth-api.md) for endpoint details and the
ready-to-import Postman collection in [`docs/postman/`](../docs/postman/).
