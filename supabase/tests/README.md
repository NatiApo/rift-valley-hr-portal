# Database security test plan

Before production, create automated tests using Supabase CLI / pgTAP or a separate integration test suite. Minimum required assertions:

1. `anon` can select published jobs only.
2. `anon` cannot select, insert, update, or delete applications.
3. `anon` cannot read staff profiles, audit events, or application history.
4. Authenticated non-HR users cannot read applications.
5. Reviewer can read applications but cannot update statuses or access CV signed URLs.
6. Recruiter can update application status but cannot invite staff or export CSV.
7. Admin can invite staff and export CSV.
8. Inactive HR profile cannot read applications or call HR management operations.
9. No authenticated browser role can list/read `applicant-cvs` directly.
10. Status changes create history entries.
11. A public submission cannot target draft, closed, or expired jobs.
12. Duplicate application for the same job/email is rejected.

Do not mark the system production-ready until tests pass in the actual Supabase project.
