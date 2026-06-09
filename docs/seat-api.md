# Seats API

> Module: `backend/src/modules/seats`  
> Base path: `/seats` (under `/api/v1`)

Multi-tenant seats are scoped by **`libraryId`** and **`branchId`**. `seatNumber` is **unique per branch**.

## Permissions

| Permission | Typical use |
|------------|-------------|
| `seat.read` | Full seat records (owner, manager, receptionist, accountant). |
| `seat.occupancy.read` | Occupancy summary + list/detail with **reduced fields** (e.g. security desk). |
| `seat.create` / `seat.update` / `seat.delete` | CRUD. |
| `seat.assign` / `seat.unassign` | Student linkage (keeps `Student.assignedSeatId` in sync). |
| `seat.bulkCreate` | Generate many seats in one request (max 500). |

## Endpoints

| Method | Path | Notes |
|--------|------|--------|
| GET | `/seats/occupancy/summary` | Aggregates total / occupied / available-assignable / by status. |
| GET | `/seats/available` | List filter preset: available assignable. |
| GET | `/seats/reserved` | Reserved or `reservedUntil` set. |
| POST | `/seats/bulk` | Body: `libraryId`, `branchId`, `prefix?`, `startNumber`, `endNumber`, `floor`, `zone`, `seatType`, `shiftType`, `padLength?`. |
| GET | `/seats` | Pagination, search, filters (`floor`, `zone`, `shiftType`, `seatType`, `status`, `occupied`, `active`, `sortBy`, `sortOrder`). |
| POST | `/seats` | Create single seat. |
| GET | `/seats/:seatId` | Detail. |
| PATCH | `/seats/:seatId` | Update metadata (not assign — use assign/unassign). |
| DELETE | `/seats/:seatId` | Hard delete; **blocked if seat is assigned**. |
| POST | `/seats/:seatId/assign` | Body: `{ "studentId" }`. Validates same branch, no double assign, not reserved/blocked/maintenance. |
| POST | `/seats/:seatId/unassign` | Clears seat + student link. |

## Assignment rules

- Student and seat must share the same **`branchId`**.
- Seat cannot be assigned if inactive, **MAINTENANCE**, **BLOCKED**, **RESERVED** with future `reservedUntil`, or already **OCCUPIED** by another student.
- Assigning moves any prior seat for that student to available.
- `PATCH /students/:id/seat` updates `Student.assignedSeatId` and **syncs the `Seat` document** via the seats service.

## Enumerations

- **seatType:** `STANDARD`, `PREMIUM`, `CABIN`, `SILENT_ZONE`
- **shiftType:** `FULL_DAY`, `MORNING`, `EVENING`, `NIGHT`
- **status:** `AVAILABLE`, `OCCUPIED`, `RESERVED`, `MAINTENANCE`, `BLOCKED`

Run `npm run seed:rbac` after adding permissions so `Role` documents include the new keys.
