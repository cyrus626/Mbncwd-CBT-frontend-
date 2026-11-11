import { useEffect, useState } from "react";
import { api } from "../../api.js";
import { Alert, Badge, Button, Card, Field, fmtDate, Spinner } from "../../components/ui.jsx";

export default function AdminCourses() {
  const [courses, setCourses] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const load = () => api("/admin/courses").then(setCourses).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const addCourse = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/courses", { method: "POST", body: { name } });
      setName("");
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!courses) return error ? <Alert>{error}</Alert> : <Spinner />;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
        <p className="text-sm text-slate-500">
          Share a course's access code with your participants so they can join it. Replace the code if it gets out.
        </p>
      </div>
      <Alert>{error}</Alert>

      <div className="mt-4 space-y-4">
        {courses.map((c) => <CourseCard key={c.id} course={c} onChanged={load} />)}
        {courses.length === 0 && <Card className="text-center text-sm text-slate-500">No courses yet — add the first one below.</Card>}
      </div>

      <Card className="mt-6">
        <h2 className="mb-2 font-semibold text-slate-900">Add a course</h2>
        <form onSubmit={addCourse} className="flex gap-2">
          <input
            required minLength={2} value={name} onChange={(e) => setName(e.target.value)} placeholder="New course name"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <Button variant="outline">Add course</Button>
        </form>
        <p className="mt-2 text-xs text-slate-400">A new course gets its own access code automatically.</p>
      </Card>
    </div>
  );
}

function CourseCard({ course, onChanged }) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const [form, setForm] = useState({ email: "", name: "", password: "" });

  const base = `/admin/courses/${course.id}`;
  const loadPeople = () => api(`${base}/participants`).then(setPeople).catch((e) => setError(e.message));

  // Run an admin action, then refresh the card and (if open) the participant list
  const act = async (fn) => {
    setError("");
    try {
      await fn();
      onChanged();
      if (open) loadPeople();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleOpen = () => {
    if (!open && people === null) loadPeople();
    setOpen(!open);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(course.enrollment_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy automatically. Select the code and copy it by hand.");
    }
  };

  const regenerate = () => {
    if (!confirm("Create a new access code? The old code stops working immediately. People already in the course are not affected.")) return;
    act(() => api(`${base}/regenerate-code`, { method: "POST" }));
  };

  const rename = () => {
    const next = prompt("Course name", course.name);
    if (!next || next.trim() === course.name) return;
    act(() => api(base, { method: "PATCH", body: { name: next.trim() } }));
  };

  const toggleApproval = () =>
    act(() => api(base, { method: "PATCH", body: { requires_approval: !course.requires_approval } }));

  const approve = (p) => act(() => api(`${base}/participants/${p.user_id}/approve`, { method: "POST" }));

  const remove = (p) => {
    const msg = p.status === "pending"
      ? `Reject ${p.name}'s request to join?`
      : `Remove ${p.name} from this course? They lose access to its tests, but their account and past results are kept.`;
    if (!confirm(msg)) return;
    act(() => api(`${base}/participants/${p.user_id}`, { method: "DELETE" }));
  };

  const addPerson = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError("");
    setAddMessage("");
    const body = { email: form.email };
    if (form.name.trim()) body.name = form.name.trim();
    if (form.password) body.password = form.password;
    try {
      const p = await api(`${base}/participants`, { method: "POST", body });
      setAddMessage(`${p.name} is now in this course.`);
      setForm({ email: "", name: "", password: "" });
      onChanged();
      loadPeople();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const pending = (people || []).filter((p) => p.status === "pending");
  const members = (people || []).filter((p) => p.status === "active");

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{course.name}</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {course.participant_count} participant{course.participant_count === 1 ? "" : "s"}
            {course.pending_count > 0 && <> · <span className="font-semibold text-amber-700">{course.pending_count} waiting for approval</span></>}
          </p>
        </div>
        <button onClick={rename} className="text-xs font-semibold text-brand-600 hover:underline">Rename</button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">Access code</div>
          <div className="font-mono text-2xl font-bold tracking-widest text-brand-800 select-all">{course.enrollment_code}</div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</Button>
          <Button variant="outline" onClick={regenerate}>Generate new code</Button>
        </div>
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={course.requires_approval} onChange={toggleApproval} />
        <span>
          <span className="font-medium text-slate-800">I must approve people who join with the code</span>
          <span className="block text-xs text-slate-500">
            Off: anyone with the code joins immediately. On: they wait in the list until you approve them.
            Switching it off doesn't approve people who are already waiting.
          </span>
        </span>
      </label>

      <div className="mt-4 space-y-3">
        <Alert>{error}</Alert>
      </div>

      <button onClick={toggleOpen} className="mt-3 text-sm font-semibold text-brand-600 hover:underline">
        {open ? "Hide participants" : `Manage participants${course.pending_count > 0 ? ` (${course.pending_count} waiting)` : ""}`}
      </button>

      {open && (
        <div className="mt-4 space-y-5 border-t border-slate-100 pt-4">
          {!people ? <Spinner /> : (
            <>
              {pending.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-amber-800">Waiting for approval ({pending.length})</h3>
                  <ul className="divide-y divide-amber-100 rounded-lg border border-amber-200 bg-amber-50">
                    {pending.map((p) => (
                      <li key={p.user_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500">{p.email} · asked {fmtDate(p.joined_at)}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => approve(p)}>Approve</Button>
                          <Button variant="outline" onClick={() => remove(p)}>Reject</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Participants ({members.length})</h3>
                {members.length === 0 ? (
                  <p className="text-sm text-slate-500">Nobody has joined yet.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                        <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2" /></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {members.map((p) => (
                          <tr key={p.user_id}>
                            <td className="px-3 py-2 font-medium">{p.name}</td>
                            <td className="px-3 py-2 text-slate-600">{p.email}</td>
                            <td className="px-3 py-2 text-slate-500">{fmtDate(p.joined_at)}</td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => remove(p)} className="text-xs font-semibold text-red-600 hover:underline">Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-1 text-sm font-semibold text-slate-700">Add a participant yourself <Badge tone="gray">shortcut</Badge></h3>
                <p className="mb-3 text-xs text-slate-500">
                  If the email already has an account, they are added to this course (or approved, if they were waiting).
                  If not, fill in a name and a starting password to create the account, give the participant those details, and ask them to change the password on their Account page.
                </p>
                <form onSubmit={addPerson} className="grid gap-3 md:grid-cols-3">
                  <Field label="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  <Field label="Name (new accounts only)" minLength={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <Field label="Starting password (new accounts only)" type="text" minLength={8} autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  <div className="md:col-span-3">
                    <Button disabled={adding}>{adding ? "Adding…" : "Add to course"}</Button>
                    {addMessage && <span className="ml-3 text-sm font-medium text-brand-700">{addMessage}</span>}
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
