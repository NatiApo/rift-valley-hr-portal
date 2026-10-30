import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, ChevronRight, Eye, FileDown, Globe2, LockKeyhole, LogOut, Search, ShieldCheck, Users, X } from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import type { Job, Role, ApplicationStatus } from "./lib/types";
import { statusLabels } from "./lib/types";

type Lang = "en" | "am";
type Profile = { id: string; full_name: string; role: Role; active: boolean };
type ApplicationRow = {
  id: string; reference_code: string; full_name: string; email: string | null; phone: string;
  city: string | null; education: string | null; experience: string | null;
  skills: string | null; cover_letter: string | null;
  status: ApplicationStatus; created_at: string; job_id: string; cv_path: string | null;
  jobs?: { title: string } | null;
};

const copy = {
  en: {
    nav: "Careers", tagline: "Make your next move matter.", intro: "Build your future with Rift Valley Hotel.",
    sub: "Explore opportunities to grow your career with our hospitality team in Adama, Ethiopia.",
    openRoles: "Open positions", search: "Search roles or departments", apply: "Apply now", details: "View details",
    noJobs: "There are no open vacancies right now. Please check again soon.",
    formTitle: "Job application", step: "Application details", fullName: "Full name", email: "Email address",
    phone: "Phone number", city: "City / town", education: "Highest education / qualification",
    experience: "Relevant experience", skills: "Skills", cover: "Why are you interested in this role?",
    cv: "CV / résumé (PDF or DOCX, max 5 MB)", consent: "I agree that Rift Valley Hotel may use my information to assess this application.",
    submit: "Submit application", sending: "Submitting…", cancel: "Cancel", required: "Please complete all required fields and attach a valid CV.",
    success: "Application submitted", successText: "Your application was received. Save this reference for your records:",
    close: "Close", admin: "HR staff", login: "HR sign in", password: "Password", signIn: "Sign in",
    logout: "Sign out", dashboard: "Recruitment dashboard", total: "Applications", jobs: "Manage vacancies",
    candidates: "Candidates", filter: "Filter by status", all: "All statuses", applicant: "Applicant",
    position: "Position", received: "Received", status: "Status", actions: "Actions", cvDownload: "Secure CV link",
    changeStatus: "Change status", addJob: "Add vacancy", title: "Job title", dept: "Department",
    location: "Location", type: "Employment type", description: "Job description", requirements: "Requirements",
    deadline: "Application deadline", publish: "Publish vacancy", saveJob: "Save vacancy", closeJob: "Close",
    staff: "Staff access", staffEmail: "New staff email", staffName: "Staff name", role: "Role",
    createStaff: "Create staff invitation", adminOnly: "Only an active administrator can manage staff.",
    accessDenied: "Your account does not have permission for this action.", config: "Setup required",
    configText: "Add your Supabase project URL and publishable key to .env, then run the SQL migration and deploy the Edge Functions.",
    publicPrivacy: "Your personal information is only used for recruitment. CV files are private and available only to authorized HR staff.",
    allFields: "Fields marked * are required.", noApplications: "No applications match this filter.", notes: "Internal notes",
    saveNote: "Save note", selectJob: "Select a vacancy", language: "Language", back: "Back to careers",
    security: "Secure recruitment portal", roleAdmin: "Administrator", roleRecruiter: "Recruiter", roleReviewer: "Read-only reviewer"
  },
  am: {
    nav: "የሥራ ዕድሎች", tagline: "ቀጣዩን የሥራ ደረጃዎን ያሳድጉ።", intro: "ወደ ሪፍት ቫሊ ሆቴል ቡድን ይቀላቀሉ።",
    sub: "በአዳማ፣ ኢትዮጵያ ከእኛ ጋር የሥራ ልምድዎን ያሳድጉ።",
    openRoles: "ክፍት የሥራ ቦታዎች", search: "የሥራ ቦታ ወይም ክፍል ይፈልጉ", apply: "አሁን ያመልክቱ", details: "ዝርዝር ይመልከቱ",
    noJobs: "በአሁኑ ጊዜ ክፍት የሥራ ቦታ የለም። እባክዎ በኋላ ይመለሱ።",
    formTitle: "የሥራ ማመልከቻ", step: "የማመልከቻ ዝርዝሮች", fullName: "ሙሉ ስም", email: "ኢሜይል", phone: "ስልክ ቁጥር",
    city: "ከተማ / አካባቢ", education: "ከፍተኛ የትምህርት ደረጃ", experience: "የሥራ ልምድ", skills: "ክህሎቶች",
    cover: "ለምን ለዚህ ሥራ ማመልከት ይፈልጋሉ?", cv: "CV / የሥራ ልምድ ሰነድ (PDF ወይም DOCX፣ ከ5 MB በታች)",
    consent: "ሪፍት ቫሊ ሆቴል የዚህን ማመልከቻ ለመገምገም መረጃዬን እንዲጠቀም እስማማለሁ።",
    submit: "ማመልከቻ ያስገቡ", sending: "በመላክ ላይ…", cancel: "ይቅር", required: "እባክዎ አስፈላጊ መረጃዎችን ይሙሉና ትክክለኛ CV ያያይዙ።",
    success: "ማመልከቻው ተልኳል", successText: "ማመልከቻዎ ደርሶናል። ይህን የማጣቀሻ ቁጥር ያስቀምጡ፦",
    close: "ዝጋ", admin: "የHR ሠራተኞች", login: "የHR መግቢያ", password: "የይለፍ ቃል", signIn: "ግባ",
    logout: "ውጣ", dashboard: "የቅጥር ዳሽቦርድ", total: "ማመልከቻዎች", jobs: "የሥራ ቦታዎችን አስተዳድር",
    candidates: "እጩዎች", filter: "በሁኔታ አጣራ", all: "ሁሉም", applicant: "አመልካች", position: "የሥራ ቦታ",
    received: "የደረሰበት ቀን", status: "ሁኔታ", actions: "ተግባራት", cvDownload: "የCV አገናኝ",
    changeStatus: "ሁኔታ ቀይር", addJob: "የሥራ ቦታ ጨምር", title: "የሥራ ርዕስ", dept: "ክፍል",
    location: "ቦታ", type: "የቅጥር አይነት", description: "የሥራ መግለጫ", requirements: "መስፈርቶች",
    deadline: "የማመልከቻ መጨረሻ ቀን", publish: "የሥራ ቦታ አትም", saveJob: "አስቀምጥ", closeJob: "ዝጋ",
    staff: "የሠራተኛ ፈቃድ", staffEmail: "የአዲስ ሠራተኛ ኢሜይል", staffName: "የሠራተኛ ስም", role: "ሚና",
    createStaff: "የሠራተኛ ግብዣ ፍጠር", adminOnly: "ሠራተኞችን ማስተዳደር የሚችለው አስተዳዳሪ ብቻ ነው።",
    accessDenied: "ይህን ተግባር ለማድረግ ፈቃድ የለዎትም።", config: "ቅንብር ያስፈልጋል",
    configText: "የSupabase አድራሻና publishable key ወደ .env ያስገቡ፣ SQL migration እና Edge Functions ያስኬዱ።",
    publicPrivacy: "መረጃዎ ለቅጥር ብቻ ይጠቅማል። CV ለተፈቀደላቸው የHR ሠራተኞች ብቻ ይገኛል።",
    allFields: "* ያለባቸው መስኮች ያስፈልጋሉ።", noApplications: "ከዚህ ማጣሪያ ጋር የሚስማማ ማመልከቻ የለም።",
    notes: "የውስጥ ማስታወሻ", saveNote: "ማስታወሻ አስቀምጥ", selectJob: "የሥራ ቦታ ይምረጡ",
    language: "ቋንቋ", back: "ወደ ሥራ ዕድሎች ተመለስ", security: "የተጠበቀ የቅጥር ፖርታል",
    roleAdmin: "አስተዳዳሪ", roleRecruiter: "ቅጥር አስፈጻሚ", roleReviewer: "ንባብ ብቻ"
  }
} as const;

function App() {
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [applicationJob, setApplicationJob] = useState<Job | null>(null);
  const [reference, setReference] = useState("");
  const [adminOpen, setAdminOpen] = useState(() => window.location.pathname === "/hr");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  async function loadJobs() {
    if (!supabaseConfigured) { setLoadingJobs(false); return; }
    const { data, error: err } = await supabase.from("jobs").select("*").eq("status", "published").order("created_at", { ascending: false });
    if (err) setError(err.message);
    setJobs((data || []) as Job[]);
    setLoadingJobs(false);
  }
  async function loadProfile(userId: string) {
    const { data } = await supabase.from("staff_profiles").select("id,full_name,role,active").eq("id", userId).maybeSingle();
    setProfile(data as Profile | null);
  }
  useEffect(() => {
    loadJobs();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
        setAdminOpen(true);
      }
      if (s?.user) setTimeout(() => loadProfile(s.user.id), 0); else setProfile(null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  const visibleJobs = useMemo(() => jobs.filter(j => `${j.title} ${j.department || ""} ${j.description}`.toLowerCase().includes(query.toLowerCase())), [jobs, query]);

  if (adminOpen) return <Admin onBack={() => { setAdminOpen(false); setError(""); setRecoveryMode(false); }} session={session} profile={profile} onError={setError} lang={lang} recoveryMode={recoveryMode} onRecoveryComplete={() => setRecoveryMode(false)} />;
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setSelectedJob(null); }}><img
  className="hotel-logo"
  src="https://i.ibb.co/mVpWYZv9/photo-2026-10-29-16-41-18.jpg"
  alt="Rift Valley Hotel logo"
/><span><b>Rift Valley Hotel</b><small>ADAMA · ETHIOPIA</small></span></a>
      <nav><a href="#vacancies">{t.nav}</a><button className="language" onClick={() => setLang(lang === "en" ? "am" : "en")}><Globe2 size={16}/>{lang === "en" ? "አማርኛ" : "English"}</button></nav>
    </header>
    <main>
      <section className="hero"><div className="hero-overlay"></div><div className="hero-content"><div className="eyebrow"><span></span>{t.security}</div><h1>{t.intro}</h1><p>{t.sub}</p><a className="primary-btn" href="#vacancies">{t.openRoles}<ChevronRight size={17}/></a></div><div className="hero-foot"><span><ShieldCheck size={16}/>{t.publicPrivacy}</span><span>RIFT VALLEY HOTEL · CAREERS</span></div></section>
      <section className="vacancy-section" id="vacancies"><div className="section-head"><div><div className="eyebrow green">CAREER OPPORTUNITIES</div><h2>{t.openRoles}</h2><p>Find the role where you can make a difference.</p></div><div className="searchbox"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search}/></div></div>
        {!supabaseConfigured ? <div className="notice"><b>{t.config}</b><p>{t.configText}</p></div> : loadingJobs ? <div className="empty">Loading vacancies…</div> : visibleJobs.length === 0 ? <div className="empty"><BriefcaseBusiness size={30}/><h3>{t.noJobs}</h3></div> : <div className="job-grid">{visibleJobs.map(job => <article className="job-card" key={job.id}><div className="job-icon"><BriefcaseBusiness size={21}/></div><div className="job-meta">{job.department || "Hospitality"} <span>·</span> {job.employment_type}</div><h3>{lang === "am" && job.title_am ? job.title_am : job.title}</h3><p className="job-location">{job.location}</p><p className="job-desc">{lang === "am" && job.description_am ? job.description_am : job.description}</p>{job.deadline && <p className="deadline">Apply by {new Date(job.deadline).toLocaleDateString()}</p>}<div className="job-actions"><button className="text-btn" onClick={() => setSelectedJob(job)}>{t.details}<ChevronRight size={16}/></button><button className="primary-btn small" onClick={() => setApplicationJob(job)}>{t.apply}</button></div></article>)}</div>}
      </section>
      <section className="values"><div><span className="value-icon"><Users size={22}/></span><h3>People first</h3><p>We value teamwork, professionalism, and genuine hospitality.</p></div><div><span className="value-icon"><ShieldCheck size={22}/></span><h3>Fair recruitment</h3><p>Applications are reviewed for job-related qualifications and experience.</p></div><div><span className="value-icon"><Building2 size={22}/></span><h3>Grow with us</h3><p>Bring your skills and help us deliver excellent guest experiences.</p></div></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><img
  className="hotel-logo"
  src="https://i.ibb.co/mVpWYZv9/photo-2026-10-29-16-41-18.jpg"
  alt="Rift Valley Hotel logo"
/><span><b>Rift Valley Hotel</b><small>ADAMA · ETHIOPIA</small></span></a><span>© {new Date().getFullYear()} Rift Valley Hotel. Recruitment portal.</span></footer>
    {selectedJob && <div className="modal-backdrop" onClick={() => setSelectedJob(null)}><div className="modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={() => setSelectedJob(null)}><X/></button><div className="eyebrow green">{selectedJob.department || "Career opportunity"}</div><h2>{lang === "am" && selectedJob.title_am ? selectedJob.title_am : selectedJob.title}</h2><p className="job-location">{selectedJob.location} · {selectedJob.employment_type}</p><h3>{t.description}</h3><p className="preserve">{lang === "am" && selectedJob.description_am ? selectedJob.description_am : selectedJob.description}</p><h3>{t.requirements}</h3><p className="preserve">{lang === "am" && selectedJob.requirements_am ? selectedJob.requirements_am : selectedJob.requirements || "Please review the job description."}</p><button className="primary-btn" onClick={() => { setApplicationJob(selectedJob); setSelectedJob(null); }}>{t.apply}<ChevronRight size={16}/></button></div></div>}
    {applicationJob && <ApplicationForm job={applicationJob} t={t} onClose={() => setApplicationJob(null)} onSuccess={ref => { setReference(ref); setApplicationJob(null); }} />}  {reference && <div className="modal-backdrop"><div className="modal success-modal"><div className="success-mark">✓</div><h2>{t.success}</h2><p>{t.successText}</p><div className="reference">{reference}</div><button className="primary-btn" onClick={() => setReference("")}>{t.close}</button></div></div>}
    {error && <div className="toast" role="alert">{error}<button onClick={() => setError("")}>×</button></div>}
  </div>;
}

function ApplicationForm({ job, t, onClose, onSuccess }: { job: Job; t: any; onClose: () => void; onSuccess: (ref: string) => void }) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    education: "",
    experience: "",
    skills: "",
    cover_letter: ""
  });
  const [cv, setCv] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm(old => ({ ...old, [k]: v }));

  async function submit(e: React.FormEvent) {
   e.preventDefault(); setError("");
if (!form.full_name.trim() || !form.phone.trim() || !form.city.trim() || !form.education.trim() || !cv || !consent) { setError(t.required); return; }    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(cv.type) || cv.size > 5 * 1024 * 1024) { setError("Upload a PDF or DOCX file no larger than 5 MB."); return; }
    if (!supabaseConfigured) { setError("Supabase is not configured. Follow README setup instructions."); return; }
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v as string));
      body.append("job_id", job.id);
      body.append("cv", cv);
      body.append("consent", "true");
      body.append("website", ""); // honeypot field; must remain empty
      const { data, error: fnError } = await supabase.functions.invoke("submit-application", { body });
      if (fnError) throw fnError;
      if (!data?.reference_code) throw new Error(data?.error || "Submission failed. Please try again.");
      onSuccess(data.reference_code);
    } catch (err: any) { setError(err.message || "Could not submit. Please try again."); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" onClick={onClose}><div className="modal application-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={onClose}><X/></button><div className="eyebrow green">{t.formTitle}</div><h2>{job.title}</h2><p className="muted">{t.allFields}</p><form onSubmit={submit} className="form-grid">
    <label>{t.fullName} *<input autoComplete="name" required value={form.full_name} onChange={e => set("full_name", e.target.value)} maxLength={120}/></label>
    <label>{t.email}<input type="email" autoComplete="email" value={form.email} onChange={e => set("email", e.target.value)} maxLength={254}/></label> <label>{t.phone} *<input type="tel" autoComplete="tel" required placeholder="+251…" value={form.phone} onChange={e => set("phone", e.target.value)} maxLength={30}/></label>
    <label>{t.city} *<input required value={form.city} onChange={e => set("city", e.target.value)} maxLength={100}/></label>
    <label className="full">{t.education} *<input required value={form.education} onChange={e => set("education", e.target.value)} maxLength={200}/></label>
    <label className="full">{t.experience}<textarea rows={2} value={form.experience} onChange={e => set("experience", e.target.value)} maxLength={3000}/></label>
    <label className="full">{t.skills}<textarea rows={2} value={form.skills} onChange={e => set("skills", e.target.value)} maxLength={2000}/></label>
    <label className="full">{t.cover}<textarea rows={3} value={form.cover_letter} onChange={e => set("cover_letter", e.target.value)} maxLength={4000}/></label>
    <label className="full file-label">{t.cv} *<input type="file" required accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={e => setCv(e.target.files?.[0] || null)}/>{cv && <small>{cv.name} · {(cv.size / 1024 / 1024).toFixed(2)} MB</small>}</label>
    <label className="consent full"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>{t.consent} <small>{t.publicPrivacy}</small></span></label>
    {error && <div className="form-error full">{error}</div>}
    <div className="form-actions full"><button type="button" className="outline-btn" onClick={onClose}>{t.cancel}</button><button disabled={busy} className="primary-btn" type="submit">{busy ? t.sending : t.submit}</button></div>
  </form></div></div>;
}

function Admin({ onBack, session, profile, onError, lang, recoveryMode, onRecoveryComplete }: { onBack: () => void; session: any; profile: Profile | null; onError: (s: string) => void; lang: Lang; recoveryMode: boolean; onRecoveryComplete: () => void }) {
  const t = copy[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [tab, setTab] = useState<"applications" | "jobs" | "staff">("applications");
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicationRow | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [showJobForm, setShowJobForm] = useState(false);
  const [jobForm, setJobForm] = useState({ title: "", title_am: "", department: "", location: "Adama, Ethiopia", employment_type: "Full-time", description: "", description_am: "", requirements: "", requirements_am: "", deadline: "" });
  const [staffForm, setStaffForm] = useState({ email: "", full_name: "", role: "reviewer" as Role });
  const [staff, setStaff] = useState<Profile[]>([]);
  const canRecruit = profile?.active && (profile.role === "admin" || profile.role === "recruiter");
  const isAdmin = profile?.active && profile.role === "admin";

  async function refresh() {
    if (!session?.user || !profile?.active) return;
    const [a, j] = await Promise.all([
      supabase.from("applications").select("id,reference_code,full_name,email,phone,city,education,experience,skills,cover_letter,status,created_at,job_id,cv_path,jobs(title)").order("created_at", { ascending: false }).limit(500),
      supabase.from("jobs").select("*").order("created_at", { ascending: false })
    ]);
    if (a.error) onError(a.error.message);
    if (j.error) onError(j.error.message);
    setApps((a.data || []) as unknown as ApplicationRow[]);
    setJobs((j.data || []) as Job[]);
    if (profile.role === "admin") {
      const { data, error } = await supabase.from("staff_profiles").select("id,full_name,role,active").order("full_name");
      if (error) onError(error.message); else setStaff((data || []) as Profile[]);
    }
  }
  useEffect(() => { if (session?.user && profile?.active) refresh(); }, [session?.user?.id, profile?.active, profile?.role]);
  async function signIn(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); onError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) onError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    if (newPassword.length < 8) {
      onError("Use a password with at least 8 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      onError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        onError(error.message);
        return;
      }
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      onRecoveryComplete();
      alert("Password updated successfully. You can now use your new password to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(id: string, status: ApplicationStatus) {
    const { error } = await supabase.functions.invoke("hr-manage", { body: { action: "set_status", application_id: id, status } });
    if (error) onError(error.message); else refresh();
  }
  async function getCv(path: string | null) {
    if (!path) return onError("No CV file is attached.");
    const { data, error } = await supabase.functions.invoke("hr-manage", { body: { action: "get_cv_url", path } });
    if (error || !data?.url) return onError(error?.message || data?.error || "Could not create CV link.");
    window.open(data.url, "_blank", "noopener,noreferrer");
  }
  function saveApplicantPdf(applicant: ApplicationRow) {
    const escapeHtml = (value: string | null | undefined) => String(value || "Not provided")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      onError("Please allow pop-ups for this site, then try Save as PDF again.");
      return;
    }
    const rows = [
      ["Full name", applicant.full_name],
      ["Reference number", applicant.reference_code],
      ["Applied position", applicant.jobs?.title || "—"],
      ["Application date", new Date(applicant.created_at).toLocaleString()],
      ["Recruitment status", statusLabels[applicant.status]],
      ["Email address", applicant.email],
      ["Phone number", applicant.phone],
      ["City / town", applicant.city],
      ["Education", applicant.education],
      ["Relevant experience", applicant.experience],
      ["Skills", applicant.skills],
      ["Why interested in this role", applicant.cover_letter]
    ];
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Candidate - ${escapeHtml(applicant.full_name)}</title><style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#1e293b;margin:0;padding:36px;line-height:1.5}
      header{border-bottom:3px solid #17634d;padding-bottom:18px;margin-bottom:24px}
      .brand{font-size:12px;letter-spacing:2px;color:#17634d;font-weight:700}
      h1{font-size:26px;margin:8px 0 2px;color:#123d32}.sub{color:#64748b;font-size:12px}
      h2{font-size:15px;color:#17634d;margin:24px 0 10px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .item{border:1px solid #dbe4df;border-radius:8px;padding:11px;break-inside:avoid}
      .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700}
      .value{font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere;margin-top:4px}
      .wide{grid-column:1/-1}footer{margin-top:30px;padding-top:12px;border-top:1px solid #dbe4df;color:#64748b;font-size:10px}
      @media print{body{padding:0}.item{break-inside:avoid}}
    </style></head><body><header><div class="brand">RIFT VALLEY HOTEL · ADAMA, ETHIOPIA</div><h1>Candidate Profile</h1><div class="sub">Confidential recruitment record · ${escapeHtml(applicant.reference_code)}</div></header>
    <div class="grid">${rows.map(([label,value],index) => `<section class="item ${index >= 9 ? "wide" : ""}"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></section>`).join("")}</div>
    <footer>Confidential. For authorized recruitment use only. Generated by Rift Valley Hotel HR Recruitment Portal.</footer>
    <script>window.onload=()=>{window.focus();window.print();};</script></body></html>`);
    printWindow.document.close();
  }

  async function saveJob(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.functions.invoke("hr-manage", { body: { action: "save_job", job: { ...jobForm, deadline: jobForm.deadline || null } } });
    if (error) onError(error.message); else { setShowJobForm(false); setJobForm({ title: "", title_am: "", department: "", location: "Adama, Ethiopia", employment_type: "Full-time", description: "", description_am: "", requirements: "", requirements_am: "", deadline: "" }); refresh(); }
    setBusy(false);
  }
  async function closeJob(id: string) {
    const { error } = await supabase.functions.invoke("hr-manage", { body: { action: "close_job", job_id: id } });
    if (error) onError(error.message); else refresh();
  }
  async function inviteStaff(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { data, error } = await supabase.functions.invoke("hr-manage", { body: { action: "invite_staff", ...staffForm } });
    if (error || data?.error) onError(error?.message || data.error); else { setStaffForm({ email: "", full_name: "", role: "reviewer" }); refresh(); alert("Invitation sent if email delivery is configured."); }
    setBusy(false);
  }
  async function exportCsv() {
    const { data, error } = await supabase.functions.invoke("hr-manage", { body: { action: "export_csv" } });
    if (error || !data?.csv) return onError(error?.message || data?.error || "Export unavailable.");
    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "rift-valley-applications.csv"; a.click(); URL.revokeObjectURL(a.href);
  }
  if (!supabaseConfigured) return <div className="admin-shell"><button className="text-btn" onClick={onBack}>← {t.back}</button><div className="notice"><b>{t.config}</b><p>{t.configText}</p></div></div>;
  if (recoveryMode) return <div className="admin-shell"><button className="text-btn" onClick={onBack}>← {t.back}</button><div className="login-card"><div className="brand-mark large"><LockKeyhole/></div><div className="eyebrow green">{t.security}</div><h1>Set a new password</h1><p>Choose a new password for your HR account.</p><form onSubmit={updatePassword}><label>New password<input type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password"/></label><label>Confirm new password<input type="password" required minLength={8} value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} autoComplete="new-password"/></label><button className="primary-btn full-btn" disabled={busy}>{busy ? "Updating password…" : "Update password"}</button></form></div></div>;
  if (!session) return <div className="admin-shell"><button className="text-btn" onClick={onBack}>← {t.back}</button><div className="login-card"><div className="brand-mark large"><LockKeyhole/></div><div className="eyebrow green">{t.security}</div><h1>{t.login}</h1><p>Authorized Rift Valley Hotel HR staff only.</p><form onSubmit={signIn}><label>{t.email}<input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"/></label><label>{t.password}<input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"/></label><button className="primary-btn full-btn" disabled={busy}>{busy ? "Signing in…" : t.signIn}</button></form></div></div>;
  if (!profile) return <div className="admin-shell"><button className="text-btn" onClick={onBack}>← {t.back}</button><div className="notice"><b>Account not authorized</b><p>Your signed-in account has no active HR profile. Ask the system administrator to provision your account.</p><button className="outline-btn" onClick={() => supabase.auth.signOut()}>{t.logout}</button></div></div>;
  if (!profile.active) return <div className="admin-shell"><div className="notice"><b>Account disabled</b><p>Contact your HR administrator.</p><button className="outline-btn" onClick={() => supabase.auth.signOut()}>{t.logout}</button></div></div>;
  const filtered = apps.filter(a => (filter === "all" || a.status === filter) && `${a.full_name} ${a.email} ${a.reference_code} ${a.jobs?.title || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="admin-shell"><header className="admin-top"><a className="brand" href="#" onClick={e => { e.preventDefault(); onBack(); }}><span className="brand-mark"><Building2/></span><span><b>Rift Valley Hotel</b><small>HR WORKSPACE</small></span></a><div className="admin-user"><span className="avatar">{profile.full_name.slice(0,1).toUpperCase()}</span><span><b>{profile.full_name}</b><small>{profile.role}</small></span><button className="icon-btn" title={t.logout} onClick={() => supabase.auth.signOut()}><LogOut size={18}/></button></div></header>
    <div className="admin-body"><aside className="sidebar"><div className="side-label">WORKSPACE</div><button className={tab === "applications" ? "side-item active" : "side-item"} onClick={() => setTab("applications")}><Users size={18}/>{t.candidates}<span>{apps.length}</span></button><button className={tab === "jobs" ? "side-item active" : "side-item"} onClick={() => setTab("jobs")}><BriefcaseBusiness size={18}/>{t.jobs}</button>{isAdmin && <button className={tab === "staff" ? "side-item active" : "side-item"} onClick={() => setTab("staff")}><ShieldCheck size={18}/>{t.staff}</button>}<div className="sidebar-foot"><ShieldCheck size={16}/> Role-based access enabled</div></aside>
    <section className="admin-content"><div className="page-heading"><div><div className="eyebrow green">RECRUITMENT OPERATIONS</div><h1>{t.dashboard}</h1><p>Welcome back, {profile.full_name}.</p></div><span className="role-pill">{profile.role}</span></div>
      {tab === "applications" && <><div className="stats"><div className="stat-card"><span>{t.total}</span><b>{apps.length}</b><small>All received</small></div><div className="stat-card"><span>Under review</span><b>{apps.filter(a => a.status === "under_review").length}</b><small>In progress</small></div><div className="stat-card"><span>Shortlisted</span><b>{apps.filter(a => a.status === "shortlisted").length}</b><small>Next-stage candidates</small></div><div className="stat-card"><span>Open vacancies</span><b>{jobs.filter(j => j.status === "published").length}</b><small>Published jobs</small></div></div>
        <div className="table-panel"><div className="table-toolbar"><div><h2>{t.candidates}</h2><p>Review and update applicant records.</p></div><div className="toolbar-actions"><div className="searchbox compact"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates"/></div>{isAdmin && <button className="outline-btn" onClick={exportCsv}>Export CSV</button>}</div></div><div className="filter-row"><label>{t.filter}<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{t.all}</option>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><span>{filtered.length} records</span></div><div className="table-scroll"><table><thead><tr><th>{t.applicant}</th><th>{t.position}</th><th>{t.received}</th><th>{t.status}</th><th>{t.actions}</th></tr></thead><tbody>{filtered.map(a => <tr key={a.id}><td><b>{a.full_name}</b><small>{a.email}</small><small>{a.phone}</small><small className="ref-code">{a.reference_code}</small></td><td>{a.jobs?.title || "—"}</td><td>{new Date(a.created_at).toLocaleDateString()}</td><td><span className={`status status-${a.status}`}>{statusLabels[a.status]}</span></td><td><div className="row-actions"><button className="outline-btn mini" onClick={() => setSelectedApplicant(a)}><Eye size={14}/> View</button>{canRecruit && <select aria-label="Change application status" value={a.status} onChange={e => changeStatus(a.id, e.target.value as ApplicationStatus)}>{Object.entries(statusLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>}</div></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty">{t.noApplications}</div>}</div></div></>}
      {selectedApplicant && <div className="modal-backdrop" onClick={() => setSelectedApplicant(null)}><div className="modal applicant-profile-modal" onClick={e => e.stopPropagation()} style={{maxWidth: "850px", width: "min(850px, 94vw)", maxHeight: "90vh", overflowY: "auto"}}><button className="modal-close" onClick={() => setSelectedApplicant(null)} aria-label="Close"><X/></button>
        <div className="eyebrow green">CONFIDENTIAL CANDIDATE RECORD</div><h2 style={{marginBottom: "6px"}}>{selectedApplicant.full_name}</h2><p className="muted" style={{marginTop: 0}}>Reference: {selectedApplicant.reference_code} · Applied {new Date(selectedApplicant.created_at).toLocaleDateString()}</p>
        <div className="stats" style={{gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", margin: "18px 0"}}><div className="stat-card"><span>Position</span><b style={{fontSize: "16px"}}>{selectedApplicant.jobs?.title || "—"}</b></div><div className="stat-card"><span>Application status</span><b style={{fontSize: "16px"}}>{statusLabels[selectedApplicant.status]}</b></div><div className="stat-card"><span>Application date</span><b style={{fontSize: "16px"}}>{new Date(selectedApplicant.created_at).toLocaleDateString()}</b></div></div>
        <div className="form-grid" style={{marginTop: "18px"}}>
          {([["Email address", selectedApplicant.email],["Phone number", selectedApplicant.phone],["City / town", selectedApplicant.city],["Education", selectedApplicant.education]] as [string,string|null][]).map(([label,value]) => <div key={label}><small className="muted">{label}</small><p style={{marginTop: "4px",overflowWrap: "anywhere"}}>{value || "Not provided"}</p></div>)}
          <div className="full"><small className="muted">Relevant experience</small><p className="preserve">{selectedApplicant.experience || "Not provided"}</p></div>
          <div className="full"><small className="muted">Skills</small><p className="preserve">{selectedApplicant.skills || "Not provided"}</p></div>
          <div className="full"><small className="muted">Why interested in this role</small><p className="preserve">{selectedApplicant.cover_letter || "Not provided"}</p></div>
        </div>
        <div className="form-actions" style={{justifyContent: "space-between", flexWrap: "wrap", marginTop: "22px"}}>
          <button className="outline-btn" disabled={profile.role === "reviewer" || !selectedApplicant.cv_path} onClick={() => getCv(selectedApplicant.cv_path)}>View attached CV</button>
          <div style={{display: "flex", gap: "10px", flexWrap: "wrap"}}><button className="outline-btn" onClick={() => saveApplicantPdf(selectedApplicant)}><FileDown size={16}/> Save as PDF</button><button className="primary-btn" onClick={() => setSelectedApplicant(null)}>Close profile</button></div>
        </div>
      </div></div>}
      {tab === "jobs" && <div className="table-panel"><div className="table-toolbar"><div><h2>{t.jobs}</h2><p>Create, publish, or close recruitment opportunities.</p></div>{canRecruit && <button className="primary-btn" onClick={() => setShowJobForm(!showJobForm)}>{t.addJob}</button>}</div>{showJobForm && <form className="job-editor" onSubmit={saveJob}><div className="form-grid"><label>{t.title} <input required value={jobForm.title} onChange={e => setJobForm({...jobForm,title:e.target.value})}/></label><label>የሥራ ርዕስ (Amharic)<input value={jobForm.title_am} onChange={e => setJobForm({...jobForm,title_am:e.target.value})}/></label><label>{t.dept}<input value={jobForm.department} onChange={e => setJobForm({...jobForm,department:e.target.value})}/></label><label>{t.location}<input required value={jobForm.location} onChange={e => setJobForm({...jobForm,location:e.target.value})}/></label><label>{t.type}<select value={jobForm.employment_type} onChange={e => setJobForm({...jobForm,employment_type:e.target.value})}><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Temporary</option><option>Internship</option></select></label><label>{t.deadline}<input type="date" value={jobForm.deadline} onChange={e => setJobForm({...jobForm,deadline:e.target.value})}/></label><label className="full">{t.description} <textarea required rows={4} value={jobForm.description} onChange={e => setJobForm({...jobForm,description:e.target.value})}/></label><label className="full">የሥራ መግለጫ (Amharic)<textarea rows={3} value={jobForm.description_am} onChange={e => setJobForm({...jobForm,description_am:e.target.value})}/></label><label className="full">{t.requirements}<textarea rows={3} value={jobForm.requirements} onChange={e => setJobForm({...jobForm,requirements:e.target.value})}/></label><label className="full">መስፈርቶች (Amharic)<textarea rows={3} value={jobForm.requirements_am} onChange={e => setJobForm({...jobForm,requirements_am:e.target.value})}/></label></div><div className="form-actions"><button type="button" className="outline-btn" onClick={() => setShowJobForm(false)}>{t.cancel}</button><button disabled={busy} className="primary-btn">{busy ? "Saving…" : t.publish}</button></div></form>}<div className="job-admin-list">{jobs.map(j => <div className="job-admin-row" key={j.id}><div><b>{j.title}</b><small>{j.department || "General"} · {j.location}</small></div><span className={`status ${j.status === "published" ? "status-hired" : "status-new"}`}>{j.status}</span>{canRecruit && j.status !== "closed" && <button className="outline-btn mini" onClick={() => closeJob(j.id)}>{t.closeJob}</button>}</div>)}</div></div>}
      {tab === "staff" && isAdmin && <div className="table-panel"><div className="table-toolbar"><div><h2>{t.staff}</h2><p>Invite staff and assign the minimum permissions they need.</p></div></div><form className="staff-form" onSubmit={inviteStaff}><label>{t.staffName}<input required value={staffForm.full_name} onChange={e => setStaffForm({...staffForm,full_name:e.target.value})}/></label><label>{t.staffEmail}<input required type="email" value={staffForm.email} onChange={e => setStaffForm({...staffForm,email:e.target.value})}/></label><label>{t.role}<select value={staffForm.role} onChange={e => setStaffForm({...staffForm,role:e.target.value as Role})}><option value="reviewer">{t.roleReviewer}</option><option value="recruiter">{t.roleRecruiter}</option><option value="admin">{t.roleAdmin}</option></select></label><button className="primary-btn" disabled={busy}>{t.createStaff}</button></form><div className="job-admin-list">{staff.map(s => <div className="job-admin-row" key={s.id}><div><b>{s.full_name}</b><small>{s.id}</small></div><span className="status status-new">{s.role}</span><span className={s.active ? "active-label" : "inactive-label"}>{s.active ? "Active" : "Disabled"}</span></div>)}</div><p className="muted">{t.adminOnly}</p></div>}
    </section></div>
    <footer className="admin-footer">Rift Valley Hotel · Recruitment data is confidential.</footer></div>;
}
export default App;