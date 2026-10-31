
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const authClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function reply(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function getActiveHrAdmin(req: Request) {
  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7);

  const { data: userData, error: userError } =
    await adminClient.auth.getUser(token);

  if (userError || !userData.user) {
    return null;
  }

  const { data: profile, error: profileError } =
    await adminClient
      .from("staff_profiles")
      .select("id, role, active")
      .eq("id", userData.user.id)
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.active !== true ||
    profile.role !== "admin"
  ) {
    return null;
  }

  return userData.user;
}

async function getActiveDepartmentManager(req: Request) {
  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice(7);

  const { data: userData, error: userError } =
    await adminClient.auth.getUser(token);

  if (userError || !userData.user) {
    return null;
  }

  const { data: profile, error: profileError } =
    await adminClient
      .from("department_profiles")
      .select(
        "id, username, full_name, department, active, must_change_password",
      )
      .eq("id", userData.user.id)
      .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.active !== true ||
    profile.must_change_password === true
  ) {
    return null;
  }

  return profile;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return reply({ error: "Method not allowed." }, 405);
  }

  try {
    const body = await req.json();

    // Manager login
    if (body.action === "manager_login") {
      const username = String(body.username ?? "")
        .trim()
        .toLowerCase();
      const password = String(body.password ?? "");

      if (
        !/^[a-z0-9._-]{3,40}$/.test(username) ||
        password.length < 1 ||
        password.length > 256
      ) {
        return reply(
          { error: "Invalid username or password." },
          400,
        );
      }

      const { data: profile, error: profileError } =
        await adminClient
          .from("department_profiles")
          .select(
            "id, username, full_name, department, active, must_change_password",
          )
          .eq("username", username)
          .maybeSingle();

      if (profileError || !profile || !profile.active) {
        return reply(
          { error: "Invalid username or password." },
          401,
        );
      }

      const internalEmail =
        `${username}@department.rvh.invalid`;

      const { data: authData, error: authError } =
        await authClient.auth.signInWithPassword({
          email: internalEmail,
          password,
        });

      if (
        authError ||
        !authData.user ||
        !authData.session ||
        authData.user.id !== profile.id
      ) {
        return reply(
          { error: "Invalid username or password." },
          401,
        );
      }

      return reply({
        success: true,
        session: authData.session,
        manager: {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name,
          department: profile.department,
          must_change_password: profile.must_change_password,
        },
      });
    }

    // Manager changes their temporary password.
   
    // Manager changes their temporary password.
    if (body.action === "change_initial_password") {
      const authorization = req.headers.get("Authorization");

      if (!authorization?.startsWith("Bearer ")) {
        return reply({ error: "Authentication required." }, 401);
      }

      const token = authorization.slice(7);

      // Verify the manager's current session.
      const { data: userData, error: userError } =
        await adminClient.auth.getUser(token);

      if (userError || !userData.user) {
        return reply({ error: "Invalid session." }, 401);
      }

      const newPassword = String(body.new_password ?? "");

      if (
        newPassword.length < 12 ||
        newPassword.length > 128
      ) {
        return reply(
          { error: "New password must be 12–128 characters." },
          400,
        );
      }

      // Confirm this is an active department manager
      // who must change their temporary password.
      const { data: profile, error: profileError } =
        await adminClient
          .from("department_profiles")
          .select("id, active, must_change_password")
          .eq("id", userData.user.id)
          .maybeSingle();

      if (
        profileError ||
        !profile ||
        !profile.active ||
        !profile.must_change_password
      ) {
        return reply(
          { error: "Password change is not available." },
          403,
        );
      }

      // Update the password using the secure admin client.
      const { error: passwordError } =
        await adminClient.auth.admin.updateUserById(
          userData.user.id,
          { password: newPassword },
        );

      if (passwordError) {
        return reply(
          { error: "Could not update password." },
          400,
        );
      }

      // Remove the first-login password requirement.
      const { error: updateError } = await adminClient
        .from("department_profiles")
        .update({ must_change_password: false })
        .eq("id", userData.user.id)
        .eq("must_change_password", true);

      if (updateError) {
        return reply(
          {
            error: "Password changed, but account setup is incomplete. Contact HR.",
          },
          500,
        );
      }

      return reply({
        success: true,
        message: "Your password has been changed successfully. Please sign in again.",
      });
    }


    // Manager submits a vacancy request.
    if (body.action === "manager_submit_request") {
      const manager = await getActiveDepartmentManager(req);

      if (!manager) {
        return reply(
          { error: "Active department manager access required." },
          403,
        );
      }

      const jobTitle = String(body.job_title ?? "").trim();
      const jobDescription = String(body.job_description ?? "").trim();
      const requirements = String(body.requirements ?? "").trim();
      const reason = String(body.reason ?? "").trim();
      const employmentType = String(body.employment_type ?? "Full-time");
      const location = String(body.location ?? "Adama, Ethiopia").trim();
      const positions = Number(body.number_of_positions ?? 1);
      const deadline = body.proposed_deadline || null;

      if (jobTitle.length < 2 || jobTitle.length > 160) {
        return reply({ error: "Job title must be 2–160 characters." }, 400);
      }

      if (
        jobDescription.length < 10 ||
        jobDescription.length > 12000
      ) {
        return reply(
          { error: "Job description must be 10–12,000 characters." },
          400,
        );
      }

      if (!Number.isInteger(positions) || positions < 1 || positions > 100) {
        return reply(
          { error: "Number of positions must be between 1 and 100." },
          400,
        );
      }

      if (location.length < 2 || location.length > 160) {
        return reply({ error: "Invalid location." }, 400);
      }

      const allowedEmploymentTypes = [
        "Full-time",
        "Part-time",
        "Contract",
        "Temporary",
      ];

      if (!allowedEmploymentTypes.includes(employmentType)) {
        return reply({ error: "Invalid employment type." }, 400);
      }

      if (
        deadline &&
        (
          typeof deadline !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
          Number.isNaN(Date.parse(`${deadline}T00:00:00Z`))
        )
      ) {
        return reply({ error: "Invalid application deadline." }, 400);
      }

      const { data: request, error: insertError } =
        await adminClient
          .from("department_vacancy_requests")
          .insert({
            department: manager.department,
            submitted_by: manager.id,
            job_title: jobTitle,
            number_of_positions: positions,
            employment_type: employmentType,
            location,
            job_description: jobDescription,
            requirements: requirements || null,
            reason: reason || null,
            proposed_deadline: deadline,
            status: "pending",
          })
          .select()
          .single();

      if (insertError || !request) {
        return reply(
          { error: "Could not submit vacancy request." },
          500,
        );
      }

      return reply({
        success: true,
        message: "Vacancy request submitted to HR.",
        request,
      });
    }

    // Manager edits their own request.
    if (body.action === "manager_update_request") {
      const manager = await getActiveDepartmentManager(req);

      if (!manager) {
        return reply(
          { error: "Active department manager access required." },
          403,
        );
      }

      const requestId = String(body.request_id ?? "");
      const jobTitle = String(body.job_title ?? "").trim();
      const jobDescription = String(body.job_description ?? "").trim();
      const requirements = String(body.requirements ?? "").trim();
      const reason = String(body.reason ?? "").trim();
      const employmentType = String(body.employment_type ?? "Full-time");
      const location = String(body.location ?? "Adama, Ethiopia").trim();
      const positions = Number(body.number_of_positions ?? 1);
      const deadline = body.proposed_deadline || null;

      if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
        return reply({ error: "Invalid request ID." }, 400);
      }

      if (jobTitle.length < 2 || jobTitle.length > 160) {
        return reply({ error: "Job title must be 2–160 characters." }, 400);
      }

      if (jobDescription.length < 10 || jobDescription.length > 12000) {
        return reply(
          { error: "Job description must be 10–12,000 characters." },
          400,
        );
      }

      if (!Number.isInteger(positions) || positions < 1 || positions > 100) {
        return reply(
          { error: "Number of positions must be between 1 and 100." },
          400,
        );
      }

      if (location.length < 2 || location.length > 160) {
        return reply({ error: "Invalid location." }, 400);
      }

      if (
        !["Full-time", "Part-time", "Contract", "Temporary"].includes(
          employmentType,
        )
      ) {
        return reply({ error: "Invalid employment type." }, 400);
      }

      if (
        deadline &&
        (
          typeof deadline !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(deadline) ||
          Number.isNaN(Date.parse(`${deadline}T00:00:00Z`))
        )
      ) {
        return reply({ error: "Invalid application deadline." }, 400);
      }

      const { data: existing, error: lookupError } = await adminClient
        .from("department_vacancy_requests")
        .select("id, status")
        .eq("id", requestId)
        .eq("submitted_by", manager.id)
        .eq("department", manager.department)
        .maybeSingle();

      if (lookupError || !existing) {
        return reply({ error: "Request not found." }, 404);
      }

      if (!["pending", "correction_requested"].includes(existing.status)) {
        return reply(
          { error: "This request can no longer be edited." },
          403,
        );
      }

      const nextStatus =
        existing.status === "correction_requested"
          ? "resubmitted"
          : "pending";

      const { data: updated, error: updateError } = await adminClient
        .from("department_vacancy_requests")
        .update({
          job_title: jobTitle,
          job_description: jobDescription,
          requirements: requirements || null,
          reason: reason || null,
          employment_type: employmentType,
          location,
          number_of_positions: positions,
          proposed_deadline: deadline,
          status: nextStatus,
        })
        .eq("id", requestId)
        .eq("submitted_by", manager.id)
        .eq("department", manager.department)
        .in("status", ["pending", "correction_requested"])
        .select()
        .maybeSingle();

      if (updateError || !updated) {
        return reply(
          { error: "Could not update request. Please try again." },
          409,
        );
      }

      return reply({
        success: true,
        message: "Vacancy request updated.",
        request: updated,
      });
    }

    // Manager views requests from their own department.
    if (body.action === "manager_list_requests") {
      const manager = await getActiveDepartmentManager(req);

      if (!manager) {
        return reply(
          { error: "Active department manager access required." },
          403,
        );
      }

      const { data: requests, error: listError } = await adminClient
        .from("department_vacancy_requests")
        .select(
          "id, job_title, number_of_positions, employment_type, location, job_description, requirements, reason, proposed_deadline, status, hr_feedback, created_at, updated_at",
        )
        .eq("department", manager.department)
        .order("created_at", { ascending: false });

      if (listError) {
        return reply(
          { error: "Could not load department requests." },
          500,
        );
      }

      return reply({
        success: true,
        department: manager.department,
        requests: requests ?? [],
      });
    }

    // All remaining actions require an active HR Admin.
    const hrAdmin = await getActiveHrAdmin(req);

    if (!hrAdmin) {
      return reply({ error: "HR Admin access required." }, 403);
    }

    // HR Admin views all department vacancy requests.
    if (body.action === "hr_list_department_requests") {
      const { data: requests, error: listError } = await adminClient
        .from("department_vacancy_requests")
        .select(`
          id,
          department,
          submitted_by,
          job_title,
          number_of_positions,
          employment_type,
          location,
          job_description,
          requirements,
          reason,
          proposed_deadline,
          status,
          hr_feedback,
          reviewed_by,
          reviewed_at,
          published_job_id,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });

      if (listError) {
        return reply(
          { error: "Could not load department vacancy requests." },
          500,
        );
      }

      return reply({
        success: true,
        requests: requests ?? [],
      });
    }

    // HR Admin reviews a department vacancy request.
    if (body.action === "hr_review_department_request") {
      const requestId = String(body.request_id ?? "");
      const decision = String(body.decision ?? "");
      const feedback = String(body.feedback ?? "").trim();

      if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
        return reply({ error: "Invalid request ID." }, 400);
      }

      const allowedDecisions = [
        "approved",
        "rejected",
        "correction_requested",
      ];

      if (!allowedDecisions.includes(decision)) {
        return reply({ error: "Invalid review decision." }, 400);
      }

      if (decision === "correction_requested" && feedback.length < 5) {
        return reply(
          { error: "Please explain what needs correction." },
          400,
        );
      }

      if (feedback.length > 4000) {
        return reply({ error: "Feedback is too long." }, 400);
      }

      const { data: updated, error: updateError } = await adminClient
        .from("department_vacancy_requests")
        .update({
          status: decision,
          hr_feedback: feedback || null,
          reviewed_by: hrAdmin.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .in("status", ["pending", "resubmitted"])
        .select()
        .maybeSingle();

      if (updateError || !updated) {
        return reply(
          {
            error: "Request not found or it has already been reviewed.",
          },
          409,
        );
      }

      return reply({
        success: true,
        message: "Department request reviewed successfully.",
        request: updated,
      });
    }

    // HR Admin publishes an approved department vacancy.
    if (body.action === "hr_publish_department_request") {
      const requestId = String(body.request_id ?? "");

      if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
        return reply({ error: "Invalid request ID." }, 400);
      }

      const { data: request, error: lookupError } = await adminClient
        .from("department_vacancy_requests")
        .select("*")
        .eq("id", requestId)
        .maybeSingle();

      if (lookupError || !request) {
        return reply({ error: "Vacancy request not found." }, 404);
      }

      if (request.status === "published" && request.published_job_id) {
        return reply({
          success: true,
          message: "This vacancy has already been published.",
          job_id: request.published_job_id,
        });
      }

      if (request.status !== "approved") {
        return reply(
          { error: "Only approved requests can be published." },
          400,
        );
      }

      const { data: job, error: jobError } = await adminClient
        .from("jobs")
        .insert({
          title: request.job_title,
          department: request.department,
          location: request.location,
          employment_type: request.employment_type,
          description: request.job_description,
          requirements: request.requirements,
          deadline: request.proposed_deadline,
          status: "published",
          created_by: hrAdmin.id,
        })
        .select("id, title, department, status")
        .single();

      if (jobError || !job) {
        return reply(
          { error: "Could not publish the vacancy." },
          500,
        );
      }

      const { data: updatedRequest, error: updateError } = await adminClient
        .from("department_vacancy_requests")
        .update({
          status: "published",
          published_job_id: job.id,
          reviewed_by: hrAdmin.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .eq("status", "approved")
        .is("published_job_id", null)
        .select("id, status, published_job_id")
        .maybeSingle();

      if (updateError || !updatedRequest) {
        await adminClient.from("jobs").delete().eq("id", job.id);

        return reply(
          {
            error: "Publishing could not be completed. Please refresh and try again.",
          },
          409,
        );
      }

      return reply({
        success: true,
        message: "Vacancy published successfully.",
        job,
        request: updatedRequest,
      });
    }

    // HR Admin views all department manager accounts.
    if (body.action === "hr_list_department_managers") {
      const { data: managers, error: listError } = await adminClient
        .from("department_profiles")
        .select(
          "id, username, full_name, department, active, must_change_password, created_at",
        )
        .order("department", { ascending: true });

      if (listError) {
        return reply(
          { error: "Could not load department managers." },
          500,
        );
      }

      return reply({
        success: true,
        managers: managers ?? [],
      });
    }

    // HR Admin activates or deactivates a department manager.
    if (body.action === "hr_set_department_manager_active") {
      const managerId = String(body.manager_id ?? "");
      const active = body.active;

      if (!/^[0-9a-f-]{36}$/i.test(managerId)) {
        return reply({ error: "Invalid manager ID." }, 400);
      }

      if (typeof active !== "boolean") {
        return reply({ error: "Active must be true or false." }, 400);
      }

      const { data: manager, error: updateError } = await adminClient
        .from("department_profiles")
        .update({ active })
        .eq("id", managerId)
        .select("id, username, full_name, department, active")
        .maybeSingle();

      if (updateError || !manager) {
        return reply(
          { error: "Could not update manager account." },
          500,
        );
      }

      return reply({
        success: true,
        message: active
          ? "Manager account activated."
          : "Manager account deactivated.",
        manager,
      });
    }

    // HR Admin resets a department manager's password.
    if (body.action === "hr_reset_department_manager_password") {
      const managerId = String(body.manager_id ?? "");
      const temporaryPassword = String(
        body.temporary_password ?? "",
      );

      if (!/^[0-9a-f-]{36}$/i.test(managerId)) {
        return reply({ error: "Invalid manager ID." }, 400);
      }

      if (
        temporaryPassword.length < 12 ||
        temporaryPassword.length > 128
      ) {
        return reply(
          { error: "Temporary password must be 12–128 characters." },
          400,
        );
      }

      const { data: manager, error: lookupError } = await adminClient
        .from("department_profiles")
        .select("id, username, active")
        .eq("id", managerId)
        .maybeSingle();

      if (lookupError || !manager) {
        return reply({ error: "Manager account not found." }, 404);
      }

      const { error: passwordError } =
        await adminClient.auth.admin.updateUserById(managerId, {
          password: temporaryPassword,
        });

      if (passwordError) {
        return reply({ error: "Could not reset password." }, 500);
      }

      const { error: profileError } = await adminClient
        .from("department_profiles")
        .update({ must_change_password: true })
        .eq("id", managerId);

      if (profileError) {
        return reply(
          {
            error: "Password was reset, but account setup needs attention.",
          },
          500,
        );
      }

      return reply({
        success: true,
        message: "Temporary password reset. The manager must change it at next login.",
        username: manager.username,
      });
    }

    // Create a department manager account.
    if (body.action === "create_manager") {
      const username = String(body.username ?? "")
        .trim()
        .toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const department = String(body.department ?? "");
      const temporaryPassword = String(
        body.temporary_password ?? "",
      );

      const allowedDepartments = [
        "Kitchen",
        "General Service",
        "F&B Service",
        "Housekeeping",
        "Finance",
        "Front Office",
      ];

      if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
        return reply({ error: "Invalid username format." }, 400);
      }

      if (fullName.length < 2 || fullName.length > 120) {
        return reply({ error: "Invalid manager name." }, 400);
      }

      if (!allowedDepartments.includes(department)) {
        return reply({ error: "Invalid department." }, 400);
      }

      if (
        temporaryPassword.length < 12 ||
        temporaryPassword.length > 128
      ) {
        return reply(
          { error: "Temporary password must be 12–128 characters." },
          400,
        );
      }

      const internalEmail =
        `${username}@department.rvh.invalid`;

      const { data: existing } = await adminClient
        .from("department_profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existing) {
        return reply({ error: "Username is already in use." }, 409);
      }

      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email: internalEmail,
          password: temporaryPassword,
          email_confirm: true,
        });

      if (createError || !newUser.user) {
        return reply(
          { error: "Could not create manager account." },
          400,
        );
      }

      const { error: profileInsertError } = await adminClient
        .from("department_profiles")
        .insert({
          id: newUser.user.id,
          username,
          full_name: fullName,
          department,
          active: true,
          must_change_password: true,
          created_by: hrAdmin.id,
        });

      if (profileInsertError) {
        await adminClient.auth.admin.deleteUser(newUser.user.id);

        return reply(
          { error: "Could not save manager profile." },
          500,
        );
      }

      return reply({
        success: true,
        message: "Department manager account created.",
        manager: {
          id: newUser.user.id,
          username,
          full_name: fullName,
          department,
          must_change_password: true,
        },
      });
    }

    return reply({ error: "Unknown action." }, 400);
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
});
