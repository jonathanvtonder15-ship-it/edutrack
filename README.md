# EduTrack

School management with attendance, classes, timetables, conduct, community service,
monitors, announcements and staff accounts. Built with Next.js, React and Supabase.

## Run locally

Use Node.js 24, npm and Docker. Install the locked dependencies:

```bash
npm ci
npx supabase start
```

The CLI creates a local PostgreSQL database and applies `supabase/migrations/`.
Copy `.env.example` to `.env.local`. Use the URL, anon key and service role key
from `npx supabase status` for the corresponding Supabase variables. Generate
**separate** private values for `SESSION_SECRET` and `SCHOOL_SETUP_TOKEN`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run `npm run dev` and open <http://localhost:3000>. Choose **Set up here**, enter
the setup code and create your school administrator. Passwords require at least
8 characters. Create staff under **Staff**, then classes, students and allocations.
Remove `SCHOOL_SETUP_TOKEN` and restart when school provisioning is complete.

The optional `OPENAI_API_KEY` enables timetable AI parsing. All other features
work without it; manual timetable entry remains available.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the fresh-project setup, environment variables,
verification and backup requirements. The migration **does not upgrade an existing
EduTrack database**. Existing school records and legacy password accounts require
an explicit data and Auth migration before switching to this version.

## Security model

- Usernames are mapped to internal Supabase Auth identities. Passwords are stored
  by Auth, never in the public profile table or browser storage.
- Access and refresh tokens are HTTP-only cookies. A separate signed cookie limits
  the app session to 12 hours, or one year when “Keep me signed in” is selected.
- `/api/data` forwards only approved database and photo requests using the verified
  user's token. It never forwards a service role token. PostgreSQL row-level security
  applies even when someone calls Supabase directly.
- Every school record is scoped to the active user's school. Relationship triggers
  reject foreign-school IDs. Staff profile/role changes use guarded server routes.
- Teaching staff can read academic records within their school and record attendance,
  conduct and community service. Attendance edits are limited to its author or
  management. Admin/SMT manage rosters, allocations and school reference data.
  Only admins manage accounts, school settings and announcements. Monitor guardians
  can read the student roster and manage monitor records; they cannot read attendance
  or conduct records. Preferences belong to their user; notifications are readable
  only by their recipient. Merit types may be added by teaching staff.
- Photos are private, restricted to the student's school, limited to 5 MiB and common
  raster image types. Admin/SMT can upload. Deactivating staff immediately removes
  database access while preserving attribution on historical records.

School accounts are provisioned by the site operator using a private setup code.
Password recovery currently uses an administrator reset in Staff; if the only admin
loses access, the operator must reset that Auth account in Supabase. Internal email
addresses do not receive mail. Do not enable email invitation/recovery flows without
first adding real verified email addresses and adapting the username mapping.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

`npm test` runs unit tests; the real integration suite is opt-in and requires a
running local app and local Supabase. Export the variables from your private local
configuration, then run:

```bash
EDUTRACK_TEST_URL=http://localhost:3000 npm test
```

The integration suite refuses remote hosts, creates two synthetic schools, tests
Auth, access boundaries, relationships, private storage and account lifecycle,
and cleans up its own rows. It requires `SCHOOL_SETUP_TOKEN`, the Supabase URL,
anon key and service role key in the test process as well as the app process.
Do not run destructive local database resets against a database you need to retain.
