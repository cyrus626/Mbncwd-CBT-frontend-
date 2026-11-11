import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api.js";
import { Alert, Badge, Button, Card, Field, fmtDate, Spinner, toIso } from "../../components/ui.jsx";

const tone = { draft: "gray", published: "green", archived: "gold" };
const empty = { course_id: "", title: "", description: "", duration_minutes: 30, pass_mark: 50, num_questions: 20, opens_at: "", closes_at: "", show_review: false };
const selectClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";

export default function AdminTests() {
  const [tests, setTests] = useState(null);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(empty);
  const [filters, setFilters] = useState({ course_id: "", status: "" });
  const [showForm, setShowForm] = useState(false);
  const [newCourse, setNewCourse] = useState("");
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);

  const query = () => {
    const p = new URLSearchParams();
    if (filters.course_id) p.set("course_id", filters.course_id);
    if (filters.status) p.set("status", filters.status);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  const loadTests = () => api(`/admin/tests${query()}`).then(setTests).catch((e) => setError(e.message));
  const loadCourses = () => api("/courses").then(setCourses).catch(() => {});

  useEffect(() => { loadTests(); }, [filters]); // reload whenever a filter changes
  useEffect(() => { loadCourses(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setFilter = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setError("");
    setProblems([]);
    try {
      await api("/admin/tests", {
        method: "POST",
        body: {
          ...form,
          course_id: Number(form.course_id),
          duration_minutes: Number(form.duration_minutes),
          pass_mark: Number(form.pass_mark),
          num_questions: Number(form.num_questions),
          description: form.description || null,
          opens_at: toIso(form.opens_at),
          closes_at: toIso(form.closes_at),
        },
      });
      setForm(empty);
      setShowForm(false);
      loadTests();
    } catch (err) {
      setError(err.message);
      setProblems(err.problems);
    }
  };

  const addCourse = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/courses", { method: "POST", body: { name: newCourse } });
      setNewCourse("");
      loadCourses();
    } catch (err) {
      setError(err.message);
    }
  };

  const courseName = (id) => courses.find((c) => c.id === id)?.name || `Course #${id}`;
  const filtered = filters.course_id || filters.status;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tests</h1>
          <p className="text-sm text-slate-500">Create tests, manage question banks and view results.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ New test"}</Button>
      </div>
      <Alert>{error}</Alert>
      {problems.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 py-3 pl-8 pr-3 text-sm text-red-700">
          {problems.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
      )}

      {showForm && (
        <Card className="my-4">
          <form onSubmit={create} className="grid gap-4 md:grid-cols-2">
            <Field label="Title" required className="md:col-span-2" value={form.title} onChange={set("title")} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Course</span>
              <select required value={form.course_id} onChange={set("course_id")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="">Select…</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Field label="Description (optional)" value={form.description} onChange={set("description")} />
            <Field label="Duration (minutes)" type="number" min={1} required value={form.duration_minutes} onChange={set("duration_minutes")} />
            <Field label="Questions per participant" type="number" min={1} required value={form.num_questions} onChange={set("num_questions")} />
            <Field label="Pass mark (%)" type="number" min={0} max={100} required value={form.pass_mark} onChange={set("pass_mark")} />
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input type="checkbox" checked={form.show_review} onChange={set("show_review")} /> Show correct answers after submitting
            </label>
            <Field label="Opens at (optional)" type="datetime-local" value={form.opens_at} onChange={set("opens_at")} />
            <Field label="Closes at (optional)" type="datetime-local" value={form.closes_at} onChange={set("closes_at")} />
            <div className="md:col-span-2"><Button>Create test (as draft)</Button></div>
          </form>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select aria-label="Filter by course" value={filters.course_id} onChange={setFilter("course_id")} className={selectClass}>
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Filter by status" value={filters.status} onChange={setFilter("status")} className={selectClass}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        {filtered && (
          <button onClick={() => setFilters({ course_id: "", status: "" })} className="text-sm font-semibold text-brand-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {!tests ? <Spinner /> : (
        <Card className="mt-3 overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Test</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Questions</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Closes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tests.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link to={`/admin/tests/${t.id}`} className="font-semibold text-brand-700 hover:underline">{t.title}</Link></td>
                  <td className="px-4 py-3">{courseName(t.course_id)}</td>
                  <td className="px-4 py-3"><Badge tone={tone[t.status]}>{t.status}</Badge></td>
                  <td className="px-4 py-3">{t.question_count} <span className="text-slate-400">(draw {t.num_questions})</span></td>
                  <td className="px-4 py-3">{t.attempt_count}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(t.closes_at)}</td>
                </tr>
              ))}
              {tests.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">{filtered ? "No tests match these filters." : "No tests yet."}</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Courses</h2>
          <Link to="/courses" className="text-sm font-semibold text-brand-600 hover:underline">Access codes &amp; participants →</Link>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {courses.map((c) => <Badge key={c.id} tone="green">{c.name}</Badge>)}
          {courses.length === 0 && <span className="text-sm text-slate-500">No courses yet — add one below.</span>}
        </div>
        <form onSubmit={addCourse} className="flex gap-2">
          <input
            required minLength={2} value={newCourse} onChange={(e) => setNewCourse(e.target.value)}
            placeholder="New course name"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <Button variant="outline">Add course</Button>
        </form>
      </Card>
    </div>
  );
}
