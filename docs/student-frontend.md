# Students — Frontend

Code lives in `frontend/src/modules/students/` with App Router pages under `src/app/(dashboard)/dashboard/students/`.

## Routes

| Page | Path |
| ---- | ---- |
| List | `/dashboard/students` |
| Add | `/dashboard/students/create` (optional `?libraryId=` for super admin). Legacy `/dashboard/students/new` redirects here. |
| Detail + tabs | `/dashboard/students/[studentId]` |
| Edit | `/dashboard/students/[studentId]/edit` |
| Summary | `/dashboard/students/[studentId]/summary` |

## Navigation

Sidebar **Students** is visible when the user has `student.read` **or** `student.read.basic` (`constants/navigation.ts`).

## Permissions in UI

- Lists and detail use `usePermissions().canAny([...])` / `<Can permission={...}>`.
- Sensitive profile blocks on the detail **Profile** tab require `student.read` (full); basic users see a reduced copy.
- **Transfer** and **Seat** actions require `student.transfer` and `student.assignSeat` respectively.

## Data layer

- **React Query** keys in `student-query-keys.ts`.
- **Axios** wrappers in `student.service.ts` (`request` / `requestDataAndMeta`).

## Table UX (list page)

- Server-side pagination, sorting, status & membership filters, debounced search.
- **Column visibility** with `useStudentTableColumns` (persisted in `localStorage`).
- **`studentToExportRow`** maps visible columns to an array of strings for future CSV/export wiring.

## Forms

- `StudentForm` — React Hook Form + Zod (`student.validation.ts`), card-based layout, optional seat block when `canAssignSeat`.

## Detail tabs (architecture)

| Tab | Now | Later |
| --- | --- | ----- |
| Profile | Full or limited fields | Same |
| Membership | Dates, transfer dialog, seat id | Seat picker from seats module |
| Attendance | `ComingSoon` | Wire to attendance API |
| Payments | `ComingSoon` | Wire to payments API |
| Notes | Read-only + link to edit | Inline edit optional |

This keeps a stable tab shell while modules are brought online.

## Environment

`NEXT_PUBLIC_API_BASE_URL` must point at the API root (e.g. `http://localhost:5000/api/v1`).
