
import { useState } from "react";
import { supabase } from "./lib/supabase";
import {
  Building2,
  LogOut,
  LockKeyhole,
  Send,
  ClipboardList,
  RefreshCw,
  Edit3,
} from "lucide-react";

type Manager = {
  id: string;
  username: string;
  full_name: string;
  department: string;
  must_change_password: boolean;
};

type VacancyRequest = {
  id: string;
  job_title: string;
  number_of_positions: number;
  employment_type: string;
  location: string;
  job_description: string;
  requirements: string | null;
  reason: string | null;
  proposed_deadline: string | null;
  status: string;
  hr_feedback: string | null;
  created_at: string;
};

const emptyForm = {
  job_title: "",
  number_of_positions: "1",
  employment_type: "Full-time",
  location: "Adama, Ethiopia",
  job_description: "",
  requirements: "",
  reason: "",
  proposed_deadline: "",
};

const statusLabels: Record<string, string> = {
  pending: "Pending HR review",
  correction_requested: "Correction requested",
  resubmitted: "Resubmitted",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

export default function DepartmentPortal() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [manager, setManager] = useState<Manager | null>(null);
  const [requests, setRequests] = useState<VacancyRequest[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function callFunction(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke(
      "department-manage",
      { body },
    );

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    return data;
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const data = await callFunction({
        action: "manager_login",
        username,
        password,
      });

      if (!data?.session?.access_token || !data?.session?.refresh_token) {
        throw new Error("Login did not return a valid session.");
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) throw sessionError;

      setManager(data.manager);
      setPassword("");

      if (!data.manager.must_change_password) {
        await loadRequests();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  async function changeInitialPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword.length < 12) {
      setError("Your new password must contain at least 12 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      await callFunction({
        action: "change_initial_password",
        new_password: newPassword,
      });

      await supabase.auth.signOut();
      setManager(null);
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully. Please sign in with your new password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed.");
    } finally {
      setBusy(false);
    }
  }

  async function loadRequests() {
    setError("");

    try {
      const data = await callFunction({
        action: "manager_list_requests",
      });

      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load requests.");
    }
  }

  function startNewRequest() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function editRequest(request: VacancyRequest) {
    setEditingId(request.id);
    setForm({
      job_title: request.job_title,
      number_of_positions: String(request.number_of_positions),
      employment_type: request.employment_type,
      location: request.location,
      job_description: request.job_description,
      requirements: request.requirements || "",
      reason: request.reason || "",
      proposed_deadline: request.proposed_deadline || "",
    });
    setShowForm(true);
    setError("");
    setMessage("");
  }

  async function saveRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const body = {
        ...form,
        number_of_positions: Number(form.number_of_positions),
        proposed_deadline: form.proposed_deadline || null,
      };

      if (editingId) {
        await callFunction({
          action: "manager_update_request",
          request_id: editingId,
          ...body,
        });
        setMessage("Your vacancy request has been updated.");
      } else {
        await callFunction({
          action: "manager_submit_request",
          ...body,
        });
        setMessage("Your vacancy request has been submitted to HR.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save request.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setManager(null);
    setRequests([]);
    setShowForm(false);
    setError("");
    setMessage("");
    setUsername("");
    setPassword("");
  }

  if (!manager) {
    return (
      <main className="department-shell">
        <section className="department-login">
          <div className="department-brand-icon"><Building2 size={30} /></div>
          <p className="department-eyebrow">RIFT VALLEY HOTEL · ADAMA</p>
          <h1>Department Portal</h1>
          <p className="department-muted">
            Secure access for department managers
          </p>

          {error && <div className="department-alert error">{error}</div>}
          {message && <div className="department-alert success">{message}</div>}

          <form onSubmit={login} className="department-form">
            <label>
              Username
              <input
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </label>

            <label>
              Password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
            </label>

            <button className="department-primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="department-footer">
            Authorized department managers only.
          </p>
        </section>
      </main>
    );
  }

  if (manager.must_change_password) {
    return (
      <main className="department-shell">
        <section className="department-login">
          <div className="department-brand-icon"><LockKeyhole size={28} /></div>
          <p className="department-eyebrow">ACCOUNT SECURITY</p>
          <h1>Change your password</h1>
          <p className="department-muted">
            Welcome, {manager.full_name}. Set a new password before continuing.
          </p>

          {error && <div className="department-alert error">{error}</div>}

          <form onSubmit={changeInitialPassword} className="department-form">
            <label>
              New password
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>

            <label>
              Confirm new password
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            <button className="department-primary" disabled={busy}>
              {busy ? "Updating…" : "Save new password"}
            </button>
          </form>

          <button className="department-text-button" onClick={logout}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="department-shell dashboard-shell">
      <header className="department-header">
        <div className="department-logo">
          <div className="department-brand-icon small"><Building2 /></div>
          <div>
            <strong>Rift Valley Hotel</strong>
            <small>DEPARTMENT WORKSPACE</small>
          </div>
        </div>

        <button className="department-logout" onClick={logout}>
          <LogOut size={17} /> Sign out
        </button>
      </header>

      <section className="department-content">
        <div className="department-welcome">
          <div>
            <p className="department-eyebrow">DEPARTMENT MANAGEMENT</p>
            <h1>Welcome, {manager.full_name}</h1>
            <p className="department-muted">
              Manage recruitment requests for your department.
            </p>
          </div>
          <span className="department-tag">{manager.department}</span>
        </div>

        {error && <div className="department-alert error">{error}</div>}
        {message && <div className="department-alert success">{message}</div>}

        <div className="department-stats">
          <div className="department-stat">
            <span>Total requests</span>
            <strong>{requests.length}</strong>
          </div>
          <div className="department-stat">
            <span>Awaiting review</span>
            <strong>
              {requests.filter((r) => ["pending", "resubmitted"].includes(r.status)).length}
            </strong>
          </div>
          <div className="department-stat">
            <span>Published vacancies</span>
            <strong>{requests.filter((r) => r.status === "published").length}</strong>
          </div>
        </div>

        <section className="department-panel">
          <div className="department-panel-heading">
            <div>
              <h2><ClipboardList size={20} /> Vacancy requests</h2>
              <p>Submit a new staffing request or follow an existing one.</p>
            </div>

            <div className="department-actions">
              <button className="department-outline" onClick={loadRequests}>
                <RefreshCw size={16} /> Refresh
              </button>
              <button className="department-primary compact" onClick={startNewRequest}>
                + New request
              </button>
            </div>
          </div>

          {showForm && (
            <form className="department-request-form" onSubmit={saveRequest}>
              <h3>{editingId ? "Edit vacancy request" : "New vacancy request"}</h3>

              <div className="department-form-grid">
                <label>
                  Job title *
                  <input
                    required
                    minLength={2}
                    maxLength={160}
                    value={form.job_title}
                    onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                  />
                </label>

                <label>
                  Number of positions *
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={form.number_of_positions}
                    onChange={(e) => setForm({ ...form, number_of_positions: e.target.value })}
                  />
                </label>

                <label>
                  Employment type
                  <select
                    value={form.employment_type}
                    onChange={(e) => setForm({ ...form, employment_type: e.target.value })}
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Temporary</option>
                  </select>
                </label>

                <label>
                  Work location
                  <input
                    required
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  />
                </label>

                <label>
                  Proposed application deadline
                  <input
                    type="date"
                    value={form.proposed_deadline}
                    onChange={(e) => setForm({ ...form, proposed_deadline: e.target.value })}
                  />
                </label>

                <label className="department-full">
                  Job description *
                  <textarea
                    required
                    minLength={10}
                    maxLength={12000}
                    rows={5}
                    value={form.job_description}
                    onChange={(e) => setForm({ ...form, job_description: e.target.value })}
                  />
                </label>

                <label className="department-full">
                  Qualifications and requirements
                  <textarea
                    rows={4}
                    value={form.requirements}
                    onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                  />
                </label>

                <label className="department-full">
                  Reason for requesting this position
                  <textarea
                    rows={3}
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </label>
              </div>

              <div className="department-form-actions">
                <button
                  type="button"
                  className="department-outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button className="department-primary" disabled={busy}>
                  <Send size={16} />
                  {busy ? "Saving…" : editingId ? "Update request" : "Submit to HR"}
                </button>
              </div>
            </form>
          )}

          <div className="department-request-list">
            {requests.length === 0 ? (
              <div className="department-empty">
                <ClipboardList size={34} />
                <h3>No requests yet</h3>
                <p>Your submitted vacancy requests will appear here.</p>
              </div>
            ) : (
              requests.map((request) => (
                <article className="department-request-card" key={request.id}>
                  <div className="department-request-top">
                    <div>
                      <h3>{request.job_title}</h3>
                      <p>
                        {request.number_of_positions} position(s) · {request.employment_type}
                      </p>
                    </div>
                    <span className={`department-status status-${request.status}`}>
                      {statusLabels[request.status] || request.status}
                    </span>
                  </div>

                  <p className="department-request-date">
                    Submitted {new Date(request.created_at).toLocaleDateString()}
                  </p>

                  {request.hr_feedback && (
                    <div className="department-feedback">
                      <strong>HR feedback</strong>
                      <p>{request.hr_feedback}</p>
                    </div>
                  )}

                  {["pending", "correction_requested"].includes(request.status) && (
                    <button
                      className="department-outline"
                      onClick={() => editRequest(request)}
                    >
                      <Edit3 size={15} /> {request.status === "pending" ? "Edit request" : "Correct and resubmit"}
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
        </section>

        <p className="department-confidential">
          Your account can only manage requests belonging to {manager.department}.
        </p>
      </section>
    </main>
  );
}
