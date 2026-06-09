# Users & onboarding (frontend)

## Public auth

- **Login** — `/login`
- **Forgot password** — `/forgot-password`
- **Request demo** — `/request-demo` (contact / next steps)
- **Register** — `/register` redirects to `/login` or `/dashboard` if already signed in (public signup removed).

## Universal login redirect

After successful login, navigation uses `getPostLoginPath()` (`src/lib/post-login.ts`):

| Role | Default landing |
|------|------------------|
| `SUPER_ADMIN` | `/dashboard/libraries` |
| `ACCOUNTANT` | `/dashboard/payments` |
| `SECURITY` | `/dashboard/attendance` |
| `MANAGER`, `RECEPTIONIST` | `/dashboard/students` |
| Others | `/dashboard` |

## User directory

| Page | Route |
|------|--------|
| List | `/dashboard/users` |
| Create | `/dashboard/users/create` |
| Detail | `/dashboard/users/:id` |
| Edit | `/dashboard/users/:id/edit` |

Sidebar **Users** requires `staff.read` or `user.read`. **Create user** requires `staff.create` or `user.create`.

## Students

Canonical create URL: **`/dashboard/students/create`**. Legacy `/dashboard/students/new` redirects with query string preserved.

## API client

`src/modules/users/users.service.ts` wraps `GET/POST/PATCH/DELETE /users`.
