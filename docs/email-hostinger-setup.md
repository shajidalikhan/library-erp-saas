# Hostinger SMTP setup (Library ERP)

Library ERP sends transactional email (password reset, demo requests, reminders) via **Nodemailer** using your Hostinger business mailbox.

## Get SMTP credentials

1. Log in to [Hostinger hPanel](https://hpanel.hostinger.com/).
2. Open **Emails** → select your mailbox (e.g. `support@libraryerp.in`).
3. Open **Configuration** / **Connect devices** and note:
   - **SMTP host:** `smtp.hostinger.com`
   - **Port:** `465` (SSL) or `587` (TLS)
   - **Username:** full email address
   - **Password:** the mailbox password (not your hPanel login)

## Configure backend `.env`

Copy from `backend/.env.example` and set:

```env
FRONTEND_URL=http://localhost:3000
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=support@libraryerp.in
SMTP_PASS=your_hostinger_email_password
SMTP_FROM="Library ERP <support@libraryerp.in>"
```

**Never commit real passwords.** Use placeholders in `.env.example` only.

## Test email

1. Start the API with valid SMTP env vars.
2. Sign in as **Super Admin**.
3. Open **Settings → Email** and use **Send test email**, or call:

```http
POST /api/v1/settings/email/test
Authorization: Bearer <token>
Content-Type: application/json

{ "to": "you@example.com" }
```

## Development without SMTP

If `SMTP_HOST`, `SMTP_USER`, or `SMTP_PASS` is empty:

- Emails are **not** sent.
- In non-production, the server logs `[email:dev]` with subject/body.
- Password reset also logs the reset link to the console.

## Production (Render / Railway)

Add the same variables in your host’s **Environment** panel. Set `FRONTEND_URL` to your Vercel URL (no trailing slash).

## Common errors

| Symptom | Fix |
|--------|-----|
| `Invalid login` | Use full email as `SMTP_USER`; verify mailbox password |
| Connection timeout | Use port `465` with `SMTP_SECURE=true`, or `587` with `SMTP_SECURE=false` |
| Emails in spam | Set `SMTP_FROM` to the same domain as `SMTP_USER`; configure SPF/DKIM in Hostinger |
| Reset link wrong host | Set `FRONTEND_URL` to your live frontend URL |

## Security

- SMTP password is **server-only** (never exposed in the UI or frontend).
- Reset tokens are stored hashed; raw tokens are not logged in production.
