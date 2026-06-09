# Demo data seed

Populate a realistic multi-tenant dataset for local QA, analytics, reports, and super-admin demo lead review.

## Prerequisites

- MongoDB connection in `backend/.env` (`MONGODB_URI`, `MONGODB_DB_NAME`)
- Node.js 20+

## Commands

```bash
cd backend
npm run seed:demo
npm run seed:demo -- --clean
```

`--clean` removes libraries whose slug starts with `demo-`, tenant users with emails on `demo.libraryerp.local`, and related payments, attendance, seats, students, notifications, and demo leads.

The script seeds RBAC if needed, ensures the platform super admin exists, then creates demo tenants unless they are already present (unless you pass `--clean`).

## What gets created

- Platform settings for support, sales, and demo notification emails
- 3 active libraries (Jaipur, Delhi, Bengaluru) with 2–3 branches each
- Library owners, managers, receptionists, accountants, and security staff per branch
- 64–78 students per library with Indian names, phones, and cities
- Seats per branch (available, occupied, reserved, maintenance)
- Seat assignments for a subset of students
- 30 days of attendance with check-in, check-out, and duration
- Fee plans, invoices (paid, partial, overdue, unpaid), and payments (CASH, UPI, CARD)
- In-app notifications for branch staff
- Demo requests for the super-admin CRM

## Test logins

| Role | Email | Password |
|------|-------|----------|
| Super admin | `admin@libraryerp.com` | `Admin123` |
| Library owner | `owner.jaipur@demo.libraryerp.local` | `Demo123!` |
| Manager | `manager.vaishali@demo.libraryerp.local` | `Demo123!` |
| Receptionist | `reception.vaishali@demo.libraryerp.local` | `Demo123!` |
| Accountant | `accounts.jaipur@demo.libraryerp.local` | `Demo123!` |
| Security | `security.vaishali@demo.libraryerp.local` | `Demo123!` |
| Student (portal) | `student.0001@demo.libraryerp.local` | `Demo123!` |

Additional staff and students use the same `Demo123!` password with unique `*@demo.libraryerp.local` emails.

## Notes

- Demo libraries use slug prefix `demo-` for safe cleanup.
- Re-run without `--clean` skips libraries that already exist; use `--clean` for a full reset.
- For a fresh super admin only, you can still run `npm run create:superadmin` separately.
