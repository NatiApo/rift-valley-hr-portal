import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return reply({ error: "Sign in required." }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return reply({ error: "Invalid session." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("staff_profiles").select("id,full_name,role,active").eq("id", user.id).maybeSingle();
  if (!profile || !profile.active) return reply({ error: "Active HR account required." }, 403);

  let body: Record<string, any>;
  try { body = await req.json(); } catch { return reply({ error: "Invalid JSON." }, 400); }
  const action = body.action;
  const isAdmin = profile.role === "admin";
  const canRecruit = isAdmin || profile.role === "recruiter";

  async function audit(actionName: string, entityType: string, entityId?: string, metadata: Record<string, unknown> = {}) {
    await admin.from("audit_events").insert({
      actor_id: user.id, action: actionName, entity_type: entityType, entity_id: entityId || null, metadata
    });
  }

  if (action === "set_status") {
    if (!canRecruit) return reply({ error: "Recruiter or administrator permission required." }, 403);
    const valid = ["new", "under_review", "shortlisted", "interview", "offered", "hired", "rejected"];
    if (!body.application_id || !valid.includes(body.status)) return reply({ error: "Invalid application or status." }, 400);
    const { error } = await admin.from("applications").update({ status: body.status }).eq("id", body.application_id);
    if (error) return reply({ error: "Could not update status." }, 500);
    await audit("application.status_changed", "application", body.application_id, { status: body.status });
    return reply({ ok: true });
  }

  if (action === "get_cv_url") {
    if (profile.role === "reviewer") return reply({ error: "Your role cannot download CV files." }, 403);
    const path = String(body.path || "");
    // Only allow the expected bucket path shape; never accept a URL from the client.
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|docx)$/i.test(path))
      return reply({ error: "Invalid CV reference." }, 400);
    const { data: signed, error } = await admin.storage.from("applicant-cvs").createSignedUrl(path, 60);
    if (error || !signed?.signedUrl) return reply({ error: "CV not found." }, 404);
    await audit("application.cv_accessed", "cv", path);
    return reply({ url: signed.signedUrl });
  }

  if (action === "save_job") {
    if (!canRecruit) return reply({ error: "Recruiter or administrator permission required." }, 403);
    const j = body.job || {};
    const title = String(j.title || "").trim();
    const description = String(j.description || "").trim();
    if (title.length < 2 || title.length > 160 || !description || description.length > 12000)
      return reply({ error: "Job title and description are required and must be within limits." }, 400);
    const record = {
      title, title_am: String(j.title_am || "").slice(0, 160) || null,
      department: String(j.department || "").slice(0, 100) || null,
      location: String(j.location || "Adama, Ethiopia").slice(0, 160),
      employment_type: String(j.employment_type || "Full-time").slice(0, 50),
      description, description_am: String(j.description_am || "").slice(0, 12000) || null,
      requirements: String(j.requirements || "").slice(0, 8000) || null,
      requirements_am: String(j.requirements_am || "").slice(0, 8000) || null,
      deadline: j.deadline || null, status: "published", created_by: user.id
    };
    const { data, error } = await admin.from("jobs").insert(record).select("id").single();
    if (error) return reply({ error: "Could not save vacancy." }, 500);
    await audit("job.published", "job", data.id);
    return reply({ ok: true, id: data.id });
  }

  if (action === "close_job") {
    if (!canRecruit) return reply({ error: "Recruiter or administrator permission required." }, 403);
    const { error } = await admin.from("jobs").update({ status: "closed" }).eq("id", body.job_id);
    if (error) return reply({ error: "Could not close vacancy." }, 500);
    await audit("job.closed", "job", String(body.job_id));
    return reply({ ok: true });
  }

  if (action === "invite_staff") {
    if (!isAdmin) return reply({ error: "Administrator permission required." }, 403);
    const inviteEmail = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const role = String(body.role || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail) || !fullName || fullName.length > 120 ||
        !["admin", "recruiter", "reviewer"].includes(role))
      return reply({ error: "Provide a valid email, name, and role." }, 400);
    const origin = Deno.env.get("APP_PUBLIC_URL");
    if (!origin) return reply({ error: "APP_PUBLIC_URL Edge Function secret is not configured." }, 500);
    const { data, error } = await admin.auth.admin.inviteUserByEmail(inviteEmail, { redirectTo: origin });
    if (error || !data.user) return reply({ error: "Could not send invitation. Check email configuration and whether the user already exists." }, 400);
    const { error: profileErr } = await admin.from("staff_profiles").insert({
      id: data.user.id, full_name: fullName, role, active: true
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return reply({ error: "Could not create HR profile." }, 500);
    }
    await audit("staff.invited", "staff", data.user.id, { role });
    return reply({ ok: true });
  }

  if (action === "export_csv") {
    if (!isAdmin) return reply({ error: "Administrator permission required." }, 403);
    const { data, error } = await admin.from("applications")
      .select("reference_code,full_name,email,phone,city,education,experience,skills,status,created_at,jobs(title)")
      .order("created_at", { ascending: false }).limit(5000);
    if (error) return reply({ error: "Export failed." }, 500);
    const quote = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
    const rows = [["Reference","Full name","Email","Phone","City","Education","Experience","Skills","Status","Received","Position"].join(",")];
    for (const a of data || []) {
      const job = Array.isArray(a.jobs) ? a.jobs[0]?.title : (a.jobs as any)?.title;
      rows.push([a.reference_code,a.full_name,a.email,a.phone,a.city,a.education,a.experience,a.skills,a.status,a.created_at,job].map(quote).join(","));
    }
    await audit("applications.csv_exported", "applications", undefined, { count: data?.length || 0 });
    return reply({ csv: rows.join("\r\n") });
  }

  return reply({ error: "Unknown action." }, 400);
});
