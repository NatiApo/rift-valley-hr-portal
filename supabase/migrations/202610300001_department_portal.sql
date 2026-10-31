-- Department Vacancy Request Portal
-- Separate from the existing HR recruitment tables.

CREATE TABLE public.department_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  department TEXT NOT NULL CHECK (
    department IN (
      'Kitchen',
      'General Service',
      'F&B Service',
      'Housekeeping',
      'Finance',
      'Front Office'
    )
  ),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT department_username_format
    CHECK (username = LOWER(username) AND username ~ '^[a-z0-9._-]{3,40}$')
);

CREATE TABLE public.department_vacancy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL CHECK (
    department IN (
      'Kitchen',
      'General Service',
      'F&B Service',
      'Housekeeping',
      'Finance',
      'Front Office'
    )
  ),
  submitted_by UUID NOT NULL REFERENCES public.department_profiles(id),
  job_title TEXT NOT NULL CHECK (char_length(trim(job_title)) BETWEEN 2 AND 160),
  number_of_positions INTEGER NOT NULL DEFAULT 1
    CHECK (number_of_positions BETWEEN 1 AND 100),
  employment_type TEXT NOT NULL DEFAULT 'Full-time',
  location TEXT NOT NULL DEFAULT 'Adama, Ethiopia',
  job_description TEXT NOT NULL CHECK (char_length(trim(job_description)) BETWEEN 10 AND 12000),
  requirements TEXT,
  reason TEXT,
  proposed_deadline DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN (
         'pending',
    'correction_requested',
    'resubmitted',
    'approved',
    'rejected',
    'published'
    )
  ),
  hr_feedback TEXT,
  reviewed_by UUID REFERENCES public.staff_profiles(id),
  reviewed_at TIMESTAMPTZ,
  published_job_id UUID REFERENCES public.jobs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX department_requests_department_idx
  ON public.department_vacancy_requests(department);

CREATE INDEX department_requests_submitter_idx
  ON public.department_vacancy_requests(submitted_by);

CREATE INDEX department_requests_status_idx
  ON public.department_vacancy_requests(status);

CREATE INDEX department_profiles_department_idx
  ON public.department_profiles(department);

ALTER TABLE public.department_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_vacancy_requests ENABLE ROW LEVEL SECURITY;

-- Managers can read only their own account profile.
CREATE POLICY "Managers read own department profile"
ON public.department_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() AND active = TRUE);

-- HR Admin can read all department manager profiles.
CREATE POLICY "HR Admin reads department profiles"
ON public.department_profiles
FOR SELECT
TO authenticated
USING (
  public.is_active_hr()
  AND public.current_hr_role() = 'admin'
);

-- Managers can read requests belonging to their own department.
CREATE POLICY "Managers read own department requests"
ON public.department_vacancy_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.department_profiles dp
    WHERE dp.id = auth.uid()
      AND dp.active = TRUE
      AND dp.department = department_vacancy_requests.department
  )
);

-- HR Admin can read all department requests.
CREATE POLICY "HR Admin reads all department requests"
ON public.department_vacancy_requests
FOR SELECT
TO authenticated
USING (
  public.is_active_hr()
  AND public.current_hr_role() = 'admin'
);

-- Managers can submit requests only for their own department.


-- Managers can edit their own requests while pending or awaiting correction.


-- No direct delete policy is provided.
-- HR review and account management will use the protected Edge Function.

-- Managers must submit and edit requests through the protected Edge Function.





-- Explicitly restrict direct table writes.
REVOKE ALL ON public.department_profiles FROM anon, authenticated;
REVOKE ALL ON public.department_vacancy_requests FROM anon, authenticated;

-- Allow reads, subject to the RLS policies above.
GRANT SELECT ON public.department_profiles TO authenticated;
GRANT SELECT ON public.department_vacancy_requests TO authenticated;

-- Automatically update timestamps when department records change.
CREATE OR REPLACE FUNCTION public.touch_department_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER department_profiles_touch_updated_at
BEFORE UPDATE ON public.department_profiles
FOR EACH ROW
EXECUTE FUNCTION public.touch_department_updated_at();

CREATE TRIGGER department_requests_touch_updated_at
BEFORE UPDATE ON public.department_vacancy_requests
FOR EACH ROW
EXECUTE FUNCTION public.touch_department_updated_at();