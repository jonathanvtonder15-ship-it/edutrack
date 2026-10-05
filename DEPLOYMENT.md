# Deploy EduTrack

## 1. Choose a database

For a **new, empty Supabase project**, use the migration in
`supabase/migrations/20261005000000_edutrack.sql`. It creates the application tables,
constraints, row-level security, provisioning function and private photo bucket.

If your Supabase project already contains school records or the legacy `users`
table, stop here. This migration intentionally refuses that schema. Back up the
existing database and storage, inventory the columns/policies, migrate password
accounts into Supabase Auth while preserving user IDs, and validate the data in a
separate project before switching traffic. Do not drop existing tables to force
this migration to run. The earlier `database/attendance-unique.sql` is only a
legacy attendance repair; fresh projects already include that constraint.

With the Supabase CLI authenticated to your own account:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Check the selected project before applying changes. Alternatively run the complete
migration in the new project's SQL editor. Never paste credentials into source.
See [Supabase migration guidance](https://supabase.com/docs/guides/deployment/database-migrations).

In Supabase Authentication settings:

- Keep the **Email/password provider enabled**.
- Disable **Allow new users to sign up**. EduTrack provisions accounts via its guarded
  server routes. These are separate settings; disabling the provider also disables login.
- Set the Site URL to the final HTTPS site URL. The app does not use public signup,
  email confirmation or password-reset emails.
- Keep refresh-token rotation enabled. Configure Auth rate limits for your expected
  school traffic. The in-process login throttle is only an additional safeguard;
  use your hosting firewall for distributed request limits.

Ensure `student-photos` is private. Keep the Data API limited to `public`; never
expose the `private` schema. Set the Data API maximum rows to 10,000 to match the
local configuration; individual screens may still request smaller limits. Do not
add anonymous grants or policies.

## 2. Configure the host

Import this repository into Vercel (Next.js preset), or use a Node.js host that runs
`npm ci`, `npm run build` and `npm start`. Static export hosting is not supported;
EduTrack requires server routes and cookies. Use Node.js 24 and HTTPS.
See [Vercel Next.js deployment](https://vercel.com/docs/frameworks/full-stack/nextjs).

Set these environment variables for the intended deployment environment:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Exact public origin, such as `https://edutrack.example.org` |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project's URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project service role/secret key, server only |
| `SESSION_SECRET` | Separate random secret, at least 32 characters |
| `SCHOOL_SETUP_TOKEN` | Separate random setup code, at least 32 characters; remove after provisioning |
| `OPENAI_API_KEY` | Optional server-only key for AI timetable parsing |

Generate secrets with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Never use `NEXT_PUBLIC_` for private keys or commit `.env.local`. Rotate any service
key that was previously committed to repository history before production use.
Use a separate database and secrets for preview deployments. Public environment
values are set at build time; rebuild after changing them. The canonical app URL
must match the browser's origin for request-origin checks.

## 3. Provision and verify

1. Deploy and open the HTTPS site. Confirm the name is **EduTrack**.
2. Select **Set up here**, enter your setup code and create the school/admin.
3. Create a teacher and a monitor guardian in Staff. Add a class, students and a
   teacher allocation. Record attendance, reload and verify it persists.
4. Upload a student photo. Check that it loads after login and fails when signed out.
5. Verify a teacher cannot manage accounts/settings, a guardian cannot access
   attendance, and a second test school cannot read the first school's records.
6. Check sign out, hard refresh, account password changes and admin password resets.
7. Remove `SCHOOL_SETUP_TOKEN` and redeploy to close school creation.
8. Enable database backups (and storage-object backups separately), monitoring and
   an operator recovery procedure. Test a restore before relying on backups.

Do not enable public database access to fix a permission error. Check the logged-in
role and migration instead. A 401 means sign-in must be renewed; a 403 means the
role is not allowed to perform that action.

## Operational limits

- The AI provider success path needs a configured OpenAI key and a separate live test.
- Some screens intentionally cap the records loaded. Check reporting/export totals
  for large schools before relying on them for complete historical reports.
- Browser storage holds UI identity and the existing offline attendance queue.
  Server authorization does not trust either; use device access controls on shared
  school computers and sign out when finished.
- Local development settings in `supabase/config.toml` do not configure hosted Auth
  settings automatically. Apply the production settings above in the dashboard.
