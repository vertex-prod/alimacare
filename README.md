# AlimaCare Admin Panel

Next.js admin panel for the AlimaCare QR intake and queue system. It reads and
manages the same Supabase database as **alimacare_user** (the patient intake
form), using the schema in `alimacare_user/database/schema.sql`:
`patients`, `queue_events`, and `queue_counters`.

## Structure

| Folder | Role |
| --- | --- |
| `app/api` | Backend — Route Handlers. All database access, using the service-role key on the server only. |
| `app/admin` | Frontend — admin pages (login, dashboard, live queue, patient records, export). |
| `components/admin` | Admin page views and dialogs. |
| `components/ui` | Shared UI primitives (buttons, cards, badges, tables, modal, toast). |
| `lib` | Types, labels, Supabase client, session, validation, and patient queries. |
| `proxy.ts` | Redirects signed-out visitors from `/admin/*` to `/admin/login`. |

### API

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in (`{ username, password }`), sets an httpOnly session cookie |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/auth/session` | Current admin |
| GET | `/api/admin/dashboard` | Today's counts, per-department summary, 7-day trend |
| GET | `/api/admin/queue?date=` | Active tickets for a day (default: today, Asia/Manila) |
| GET | `/api/admin/patients?q=&status=&department=&purpose=&from=&to=&page=` | Search patient records |
| GET | `/api/admin/patients/:id` | Full record and status history |
| PATCH | `/api/admin/patients/:id` | Assign doctor/room, wait estimate, priority lane, or transfer department |
| POST | `/api/admin/patients/:id/status` | Change status (`{ status, notes?, assignedDoctor?, assignedRoom? }`) |
| GET | `/api/admin/export?from=&to=` | CSV export by queue date |

Status changes follow `lib/labels.ts → STATUS_TRANSITIONS`
(`PENDING_RECEPTION → APPROVED → WAITING → CALLED → ONGOING → COMPLETED`, plus
cancel / no-show / archive / reopen). The database trigger stamps
`called_time`, `consultation_start_time`, and `completed_time` and writes the
`queue_events` row; the API adds the admin's name and note to that row.

## Setup

1. Apply `alimacare_user/database/schema.sql` to your Supabase project (if not
   already done).
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — same project as
     alimacare_user.
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD` — the admin login. The schema has no
     staff table, so the account is configured here.
   - `ADMIN_SESSION_SECRET` — 32+ random characters used to sign the session
     cookie. Changing it signs everyone out.
3. Install and run:

```bash
npm install
npm run dev
```

Open <http://localhost:3000/admin>.

## Security notes

- The service-role key is only used in `lib/supabase.ts` (marked
  `server-only`); the browser only talks to `/api/*`.
- Sessions are HMAC-signed, httpOnly, SameSite=Lax cookies valid for 12 hours.
  Mutations also check the `Origin` header.
- Login is throttled per IP (10 failures / 15 min, in-memory).
- CSV exports contain personal health information and escape formula-like
  cells.
