# Rift Valley Hotel — HR Recruitment Portal

A React + TypeScript recruitment portal for Rift Valley Hotel, Adama, Ethiopia. It includes a bilingual English/Amharic public careers page, application form, private CV upload through a Supabase Edge Function, HR login, roles, vacancy management, application status updates, secure CV links, staff invitations, and administrator-only CSV export.

## Important deployment status

This is a functional starter implementation, not a security certification. Before accepting real applicants, finish the launch checklist below—especially rate limiting / anti-bot protection, email delivery settings, RLS tests, backups, retention policy, and a full security review. Do not upload real applicant data until you have verified the deployed policies.

## Stack

- React, Vite, TypeScript
- Supabase Auth, PostgreSQL, Storage, Edge Functions
- Cloudflare Pages or Vercel for static frontend hosting

## 1. Prerequisites

Install:
- Node.js LTS: https://nodejs.org/
- Git: https://git-scm.com/
- VS Code: https://code.visualstudio.com/

Create a Supabase project at https://supabase.com/.

## 2. Run locally

From this folder:

```bash
npm install
cp .env.example .env
```

On Windows PowerShell, if `cp` does not work:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and set:
- `VITE_SUPABASE_URL` to the Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` to the project's publishable/anon key

Never put the Supabase service-role key in `.env` with a `VITE_` prefix or in any frontend file.

Run:

```bash
npm run dev
```

Open the local URL printed by Vite.

## 3. Create the database

In Supabase Dashboard → SQL Editor, run the entire file:

`supabase/migrations/202610280001_hr_portal.sql`

Review the output for errors. This creates the tables, enums, policies, indexes, private `applicant-cvs` bucket, and audit/status history.

## 4. Deploy Edge Functions

Install Supabase CLI using the official instructions:
https://supabase.com/docs/guides/cli

Log in and link the project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Set secrets. Replace the example values:

```bash
supabase secrets set ALLOWED_ORIGIN=https://YOUR-PROJECT.pages.dev
supabase secrets set APP_PUBLIC_URL=https://YOUR-PROJECT.pages.dev
```

The hosted Supabase project provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Verify these are available in function settings; do not expose the service role to the browser.

Deploy:

```bash
supabase functions deploy submit-application
supabase functions deploy hr-manage
```

For local function development, use the Supabase CLI local development workflow and a local `.env` file kept out of Git.

## 5. Configure Auth

In Supabase Dashboard → Authentication → URL Configuration:
- Set Site URL to the deployed website URL.
- Add the local development URL and production URL to allowed redirect URLs.
- Configure email delivery / SMTP before inviting HR staff. Default email limits may be unsuitable for production.

## 6. Create the first administrator securely

Do not allow public sign-up for HR staff.

1. In Supabase Dashboard → Authentication → Users, create/invite the first trusted HR account.
2. Copy that user's UUID.
3. In SQL Editor, replace the values below and run the insert:

```sql
insert into public.staff_profiles (id, full_name, role, active)
values ('REPLACE_WITH_AUTH_USER_UUID', 'HR Administrator', 'admin', true);
```

Only a trusted project owner/database administrator should do this. Never make a public endpoint that lets someone assign themselves the admin role. Subsequent staff invitations should be made from the signed-in admin dashboard.

## 7. Test locally

```bash
npm run build
```

Before launch, verify all of these:
- Public visitor can view only published and non-expired jobs.
- Public visitor cannot query `applications`, `staff_profiles`, `audit_events`, or status history.
- Public visitor cannot read/list the CV bucket.
- Valid application stores a CV privately and returns a reference code.
- Same email cannot apply twice to the same vacancy.
- Closed/expired jobs reject submissions.
- Reviewer cannot change status, download CVs, invite staff, or export CSV.
- Recruiter cannot invite staff or export CSV.
- Admin can invite staff and export data.
- Disabled HR profiles lose access.
- A guessed application ID or CV path cannot grant access.
- File type, file size, required fields, and text lengths are validated by the Edge Function.

## 8. Deploy to Cloudflare Pages

Push the project to a private GitHub repository. In Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git, select the repository.

Build settings:
- Framework preset: Vite
- Build command: `npm run build`
- Build output directory: `dist`

Set these public frontend environment variables in the Pages project:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Redeploy after adding variables. Add the exact Pages domain to `ALLOWED_ORIGIN` and `APP_PUBLIC_URL` Edge Function secrets, then redeploy the functions if needed.

Vercel can also host the static frontend with build command `npm run build` and output directory `dist`.

## 9. Launch hardening still required

The included honeypot is only a basic spam deterrent. Before public launch, add:
- Server-side rate limiting using a trusted provider / durable store and a verified anti-bot solution.
- A restrictive CORS allowlist (never `*` for production).
- Security headers and an appropriate Content Security Policy.
- Malware scanning or a documented file-review process for uploaded CVs.
- Email notification provider and verified sender domain if notifications are needed.
- Backup and restore test, monitoring, retention and deletion workflow.
- Legal review of privacy notice and data handling applicable in Ethiopia.
- Automated RLS tests and independent security review.

Free-tier quotas, inactive-project behavior, email limits, storage limits, and regional availability may change. Check current provider terms before production use.

## Data minimization

The application asks for job-related contact, education, experience, skills, cover letter, and CV. Do not request national ID, religion, health data, family status, or other sensitive details unless truly necessary and legally reviewed. Set and enforce a retention schedule for unsuccessful applications.
