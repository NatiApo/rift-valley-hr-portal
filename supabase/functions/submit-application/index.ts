import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const maxBytes = 5 * 1024 * 1024;
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > maxBytes + 100_000) return json({ error: "Request too large." }, 413);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "Invalid form data." }, 400); }

  // Honeypot. Real users should leave this blank.
  if (String(form.get("website") || "").trim()) return json({ error: "Unable to accept this submission." }, 400);
  const consent = String(form.get("consent") || "") === "true";
  const jobId = String(form.get("job_id") || "");
  const full_name = String(form.get("full_name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const phone = String(form.get("phone") || "").trim();
  const city = String(form.get("city") || "").trim();
  const education = String(form.get("education") || "").trim();
  const experience = String(form.get("experience") || "").trim();
  const skills = String(form.get("skills") || "").trim();
  const cover_letter = String(form.get("cover_letter") || "").trim();
  const cv = form.get("cv");

  if (!consent || !jobId || !full_name || !email || !phone || !city || !education || !(cv instanceof File))
    return json({ error: "Please complete all required fields and attach a CV." }, 400);
  if (full_name.length > 120 || email.length > 254 || phone.length > 30 || city.length > 100 ||
      education.length > 200 || experience.length > 3000 || skills.length > 2000 || cover_letter.length > 4000)
    return json({ error: "One or more fields exceed the allowed length." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (cv.size < 1 || cv.size > maxBytes) return json({ error: "CV must be no larger than 5 MB." }, 400);
  const mime = cv.type;
  const allowed = new Set([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ]);
  if (!allowed.has(mime)) return json({ error: "Only PDF and DOCX CV files are accepted." }, 400);
  // Basic signature checks prevent trivial file-type spoofing. This is not malware scanning.
  const bytes = new Uint8Array(await cv.slice(0, 8).arrayBuffer());
  if (mime === "application/pdf" && !(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46))
    return json({ error: "The uploaded file does not appear to be a valid PDF." }, 400);
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      !(bytes[0] === 0x50 && bytes[1] === 0x4b))
    return json({ error: "The uploaded file does not appear to be a valid DOCX." }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Do not accept applications for unpublished, expired, or closed vacancies.
  const { data: job, error: jobErr } = await db.from("jobs").select("id,status,deadline").eq("id", jobId).maybeSingle();
  if (jobErr || !job || job.status !== "published" || (job.deadline && job.deadline < new Date().toISOString().slice(0, 10)))
    return json({ error: "This vacancy is no longer accepting applications." }, 400);

  const reference_code = `RVH-${new Date().getUTCFullYear()}-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const ext = mime === "application/pdf" ? "pdf" : "docx";
  const path = `${jobId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadErr } = await db.storage.from("applicant-cvs").upload(path, cv, {
    contentType: mime, upsert: false
  });
  if (uploadErr) return json({ error: "CV upload failed. Please try again." }, 500);

  const { error: insertErr } = await db.from("applications").insert({
    reference_code, job_id: jobId, full_name, email, phone, city, education,
    experience, skills, cover_letter, cv_path: path, consent_at: new Date().toISOString()
  });
  if (insertErr) {
    await db.storage.from("applicant-cvs").remove([path]);
    if (insertErr.code === "23505") return json({ error: "An application with this email already exists for this vacancy." }, 409);
    return json({ error: "Could not save your application. Please try again." }, 500);
  }

  // No applicant data is logged. Add a production rate-limit/anti-bot provider before public launch.
  return json({ reference_code }, 201);
});
