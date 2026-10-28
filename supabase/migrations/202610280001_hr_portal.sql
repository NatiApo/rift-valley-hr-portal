-- Rift Valley Hotel HR Portal schema
-- Run in Supabase SQL Editor or via Supabase CLI.
create extension if not exists pgcrypto;

create type public.hr_role as enum ('admin', 'recruiter', 'reviewer');
create type public.application_status as enum
  ('new', 'under_review', 'shortlisted', 'interview', 'offered', 'hired', 'rejected');
create type public.job_status as enum ('draft', 'published', 'closed');

create table public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role public.hr_role not null default 'reviewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 160),
  title_am text,
  department text,
  location text not null default 'Adama, Ethiopia',
  employment_type text not null default 'Full-time',
  description text not null,
  description_am text,
  requirements text,
  requirements_am text,
  deadline date,
  status public.job_status not null default 'draft',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique,
  job_id uuid not null references public.jobs(id) on delete restrict,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) between 5 and 30),
  city text not null check (char_length(city) between 1 and 100),
  education text not null check (char_length(education) between 1 and 200),
  experience text not null default '' check (char_length(experience) <= 3000),
  skills text not null default '' check (char_length(skills) <= 2000),
  cover_letter text not null default '' check (char_length(cover_letter) <= 4000),
  cv_path text not null,
  consent_at timestamptz not null,
  status public.application_status not null default 'new',
  internal_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, email)
);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  old_status public.application_status,
  new_status public.application_status not null,
  changed_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index jobs_public_search_idx on public.jobs(status, created_at desc);
create index applications_created_idx on public.applications(created_at desc);
create index applications_status_idx on public.applications(status);
create index applications_job_idx on public.applications(job_id);
create index applications_email_idx on public.applications(lower(email));

-- The helper reads the role from a protected table. Do not put the role in
-- user-editable auth metadata. The function is intentionally not executable by anon.
create or replace function public.current_hr_role()
returns public.hr_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.staff_profiles p
  where p.id = (select auth.uid()) and p.active = true
$$;

create or replace function public.is_active_hr()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_profiles p
    where p.id = (select auth.uid()) and p.active = true
  )
$$;

revoke all on function public.current_hr_role() from public, anon;
revoke all on function public.is_active_hr() from public, anon;
grant execute on function public.current_hr_role() to authenticated;
grant execute on function public.is_active_hr() to authenticated;

-- Every sensitive table uses RLS. Public visitors can read only published vacancies.
alter table public.staff_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.application_status_history enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.staff_profiles, public.jobs, public.applications,
  public.application_status_history, public.audit_events from anon, authenticated;

grant select on public.jobs to anon, authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
grant select on public.staff_profiles to authenticated;
grant select on public.applications to authenticated;
grant update (status, internal_notes, updated_at) on public.applications to authenticated;
grant select, insert on public.application_status_history to authenticated;
grant select, insert on public.audit_events to authenticated;

create policy "Public can read published jobs"
on public.jobs for select to anon, authenticated
using (status = 'published' and (deadline is null or deadline >= current_date));

create policy "Active HR can read all jobs"
on public.jobs for select to authenticated
using (public.is_active_hr());

create policy "Recruiters and admins create jobs"
on public.jobs for insert to authenticated
with check (public.current_hr_role() in ('admin', 'recruiter') and created_by = auth.uid());

create policy "Recruiters and admins update jobs"
on public.jobs for update to authenticated
using (public.current_hr_role() in ('admin', 'recruiter'))
with check (public.current_hr_role() in ('admin', 'recruiter'));

create policy "Admins delete jobs"
on public.jobs for delete to authenticated
using (public.current_hr_role() = 'admin');

create policy "Active HR can read staff profiles"
on public.staff_profiles for select to authenticated
using (public.is_active_hr());

create policy "Active HR can read applications"
on public.applications for select to authenticated
using (public.is_active_hr());

create policy "Recruiters and admins update applications"
on public.applications for update to authenticated
using (public.current_hr_role() in ('admin', 'recruiter'))
with check (public.current_hr_role() in ('admin', 'recruiter'));

create policy "Active HR can read status history"
on public.application_status_history for select to authenticated
using (public.is_active_hr());

create policy "Recruiters and admins add status history"
on public.application_status_history for insert to authenticated
with check (public.current_hr_role() in ('admin', 'recruiter') and changed_by = auth.uid());

create policy "Admins read audit events"
on public.audit_events for select to authenticated
using (public.current_hr_role() = 'admin');

create policy "Active HR writes audit events"
on public.audit_events for insert to authenticated
with check (public.is_active_hr() and actor_id = auth.uid());

-- CV bucket is private. Browser users do not receive direct bucket access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('applicant-cvs', 'applicant-cvs', false, 5242880,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

-- Intentionally no anon/authenticated storage.objects policies for this bucket.
-- Only the server-side Edge Functions use the service role to write/read files,
-- after validating the requester's role. Keep the service role secret.

-- Audit every status change, even if an update comes from a trusted SQL session.
create or replace function public.log_application_status_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.application_status_history(application_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger application_status_change_trigger
before update on public.applications
for each row execute function public.log_application_status_change();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger jobs_touch_updated_at before update on public.jobs
for each row execute function public.touch_updated_at();

-- IMPORTANT: Do not grant anonymous users INSERT on applications.
-- Public applications must go through the submit-application Edge Function.
