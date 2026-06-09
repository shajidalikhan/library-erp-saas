# Library & Branch Management — Frontend

Feature code lives under `frontend/src/modules/library/` (types, validation, API service, and forms). Route pages use the Next.js App Router under `src/app/(dashboard)/dashboard/libraries/`.

## Routes

| UI | Path |
| -- | ---- |
| Libraries list | `/dashboard/libraries` |
| Create library | `/dashboard/libraries/new` |
| Library detail | `/dashboard/libraries/[libraryId]` |
| Edit library | `/dashboard/libraries/[libraryId]/edit` |
| Branch list | `/dashboard/libraries/[libraryId]/branches` |
| Create branch | `/dashboard/libraries/[libraryId]/branches/new` |
| Branch detail | `/dashboard/libraries/[libraryId]/branches/[branchId]` |
| Edit branch | `/dashboard/libraries/[libraryId]/branches/[branchId]/edit` |

`/dashboard/branches` redirects to the tenant’s branch list when `user.libraryId` is set; otherwise it sends users to `/dashboard/libraries`.

## Navigation (RBAC)

Defined in `src/constants/navigation.ts` and rendered by `SidebarNav`:

- **Libraries** — requires `library.create` (platform administrators in the default seed).
- **My library** — requires `library.read` and a tenant `libraryId` on the user (rewrites to `/dashboard/libraries/{libraryId}`).
- **Branches** — requires `branch.read` and a tenant `libraryId` (rewrites to `/dashboard/libraries/{libraryId}/branches`).

UI gates use `<Can permission={...}>` and `usePermissions().can(...)` — never raw role string checks in feature components.

## Data fetching

- **React Query** with keys from `library-query-keys.ts`.
- **Axios** via `libraryApi` in `library.service.ts`.
- List endpoints use `requestDataAndMeta` (`lib/axios.ts`) to read `meta.pagination`.

Tables implement **debounced search** (`useDebounce`), **server-side pagination**, **sorting**, and **filters** (status / active).

## Forms

- **React Hook Form** + **Zod** (`@hookform/resolvers/zod`).
- `LibraryForm` and `BranchForm` are reusable across create/edit screens.

## States

- **Loading**: route-level `loading.tsx` skeletons and inline table skeletons.
- **Empty**: `EmptyState` when lists have no rows.
- **Errors**: query error banners and toast notifications on mutations.
- **Delete**: confirmation `Dialog` before destructive calls.

## Environment

`NEXT_PUBLIC_API_BASE_URL` must point at the backend API root (e.g. `http://localhost:5000/api/v1`).
