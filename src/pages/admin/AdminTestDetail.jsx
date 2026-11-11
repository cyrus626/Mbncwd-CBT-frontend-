import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, download } from "../../api.js";
import { Alert, Badge, Button, Card, Field, fmtDate, Spinner, toIso, toLocalInput } from "../../components/ui.jsx";
import EditQuestion from "../../components/EditQuestion.jsx";
import Marking from "../../components/Marking.jsx";

const tabs = ["Questions", "Import", "Marking", "Reports", "Results", "Settings"];
const statusTone = { draft: "gray", published: "green", archived: "gold" };
const TYPES = [
  { id: "mcq", label: "Multiple choice" },
  { id: "short", label: "Short answer" },
  { id: "theory", label: "Theory" },
];
const typeLabel = Object.fromEntries(TYPES.map((t) => [t.id, t.label]));
const typeTone = { mcq: "gray", short: "gold", theory: "green" };
const blankQ = () => ({
  type: "mcq",
  text: "",
  marks: 1,
  options: [{ text: "", is_correct: true }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }],
  accepted: "",
  model_answer: "",
});
const inputClass = "w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500";

// The backend explains *why* a change was refused as a list; show it under the message.
function Problems({ items }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 py-3 pl-8 pr-3 text-sm text-red-700">
      {items.map((p, i) => <li key={i}>{p}</li>)}
    </ul>
  );
}

export default function AdminTestDetail() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [tab, setTab] = useState("Questions");
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);

  const loadTest = useCallback(
    () => api(`/admin/tests/${testId}`).then(setTest).catch((e) => setError(e.message)),
    [testId]
  );
  useEffect(() => { loadTest(); }, [loadTest]);

  const setStatus = async (status) => {
    setError("");
    setProblems([]);
    try { setTest(await api(`/admin/tests/${testId}/status`, { method: "PATCH", body: { status } })); }
    catch (e) { setError(e.message); setProblems(e.problems); }
  };

  const remove = async () => {
    if (!confirm("Delete this test permanently?")) return;
    setError("");
    setProblems([]);
    try { await api(`/admin/tests/${testId}`, { method: "DELETE" }); navigate("/admin"); }
    catch (e) { setError(e.message); }
  };

  if (!test) return error ? <Alert>{error}</Alert> : <Spinner />;

  return (
    <div>
      <Link to="/admin" className="text-sm text-brand-600 hover:underline">← All tests</Link>
      <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{test.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {test.duration_minutes} min · draws {test.num_questions} of {test.question_count} questions · pass mark {test.pass_mark}% · {test.attempt_count} attempt(s)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={statusTone[test.status]}>{test.status}</Badge>
          {test.status !== "published" && <Button onClick={() => setStatus("published")}>Publish</Button>}
          {test.status === "published" && <Button variant="outline" onClick={() => setStatus("archived")}>Archive</Button>}
          {test.status === "published" && <Button variant="outline" onClick={() => setStatus("draft")}>Unpublish</Button>}
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
      </div>
      <Alert>{error}</Alert>
      <Problems items={problems} />

      <div className="my-4 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Questions" && <Questions testId={testId} onChange={loadTest} />}
      {tab === "Import" && <Import testId={testId} onDone={loadTest} />}
      {tab === "Marking" && <Marking testId={testId} />}
      {tab === "Reports" && <Reports testId={testId} />}
      {tab === "Results" && <Results testId={testId} />}
      {tab === "Settings" && <Settings test={test} onSaved={setTest} />}
    </div>
  );
}

function Questions({ testId, onChange }) {
  const [qs, setQs] = useState(null);
  const [form, setForm] = useState(blankQ);
  const [editing, setEditing] = useState(null);
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState("");
  const load = () =>
    api(`/admin/tests/${testId}/questions${showRetired ? "?include_inactive=true" : ""}`)
      .then(setQs)
      .catch((e) => setError(e.message));
  useEffect(() => { load(); }, [testId, showRetired]);

  const setOpt = (i, patch) =>
    setForm({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, ...patch } : patch.is_correct ? { ...o, is_correct: false } : o)) });

  const addOption = () =>
    form.options.length < 6 && setForm({ ...form, options: [...form.options, { text: "", is_correct: false }] });

  const removeOption = (i) => {
    if (form.options.length <= 2) return;
    const options = form.options.filter((_, j) => j !== i);
    if (!options.some((o) => o.is_correct)) options[0] = { ...options[0], is_correct: true }; // always keep one correct answer
    setForm({ ...form, options });
  };

  const add = async (e) => {
    e.preventDefault();
    setError("");
    const body = { question_type: form.type, text: form.text, marks: Number(form.marks) };

    if (form.type === "mcq") {
      const correct = form.options.find((o) => o.is_correct);
      if (!correct || !correct.text.trim()) {
        setError("Select the correct answer, and make sure that option has text.");
        return;
      }
      body.options = form.options.filter((o) => o.text.trim());
    } else {
      if (form.type === "short") {
        body.accepted_answers = form.accepted.split("\n").map((x) => x.trim()).filter(Boolean);
        if (!body.accepted_answers.length) {
          setError("Enter at least one accepted answer.");
          return;
        }
      }
      if (form.model_answer.trim()) body.model_answer = form.model_answer;
    }

    try {
      await api(`/admin/tests/${testId}/questions`, { method: "POST", body });
      setForm({ ...blankQ(), type: form.type, marks: form.marks }); // keep the type and marks for the next one
      load();
      onChange();
    } catch (err) { setError(err.message); }
  };

  const del = async (id) => {
    if (!confirm("Delete this question?")) return;
    try { await api(`/admin/questions/${id}`, { method: "DELETE" }); load(); onChange(); }
    catch (e) { setError(e.message); }
  };

  // Number only the live questions; retired versions are labelled instead
  let counter = 0;
  const rows = (qs || []).map((q) => ({ q, num: q.is_active ? ++counter : null }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {editing && <EditQuestion question={editing} onClose={() => setEditing(null)} onSaved={() => { load(); onChange(); }} />}
      <div className="space-y-3">
        <Alert>{error}</Alert>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Show retired versions (questions replaced after participants had seen them)
        </label>
        {!qs ? <Spinner /> : rows.map(({ q, num }) => (
          <Card key={q.id} className={q.is_active ? "" : "bg-slate-50 opacity-70"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge tone={typeTone[q.question_type || "mcq"]}>{typeLabel[q.question_type || "mcq"]}</Badge>
                <p className="mt-1.5 whitespace-pre-wrap font-medium text-slate-900">{q.is_active ? `${num}. ` : ""}{q.text}</p>
              </div>
              {q.is_active ? (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(q)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                  <button onClick={() => del(q.id)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
                </div>
              ) : <Badge tone="gold">Retired</Badge>}
            </div>
            {q.options.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {q.options.map((o) => (
                  <li key={o.id} className={o.is_correct ? "font-semibold text-brand-700" : "text-slate-600"}>
                    {o.is_correct ? "✓" : "○"} {o.text}
                  </li>
                ))}
              </ul>
            )}
            {q.accepted_answers?.length > 0 && (
              <p className="mt-2 text-sm text-slate-600"><span className="font-semibold">Accepted:</span> {q.accepted_answers.join(" · ")}</p>
            )}
            {q.model_answer && (
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-slate-500"><span className="font-semibold">Model answer:</span> {q.model_answer}</p>
            )}
            <p className="mt-2 text-xs text-slate-400">{q.marks} mark(s)</p>
          </Card>
        ))}
        {qs && counter === 0 && !showRetired && <Card className="text-center text-sm text-slate-500">No questions yet.</Card>}
      </div>

      <Card className="h-fit">
        <h2 className="mb-3 font-semibold text-slate-900">Add a question</h2>
        <form onSubmit={add} className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button
                key={t.id} type="button" onClick={() => setForm({ ...form, type: t.id, marks: t.id === "theory" && Number(form.marks) === 1 ? 5 : form.marks })}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${form.type === t.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea required rows={3} placeholder="Question text" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
            className={inputClass} />

          {form.type === "mcq" && (
            <>
              {form.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" checked={o.is_correct} onChange={() => setOpt(i, { is_correct: true })} title="Mark as correct" />
                  <input placeholder={`Option ${String.fromCharCode(65 + i)}${i > 1 ? " (optional)" : ""}`} required={i < 2} value={o.text}
                    onChange={(e) => setOpt(i, { text: e.target.value })}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500" />
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)} className="px-1 text-lg text-slate-400 hover:text-red-600" aria-label="Remove option">×</button>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-400">Select the radio button beside the correct option.</p>
                {form.options.length < 6 && (
                  <button type="button" onClick={addOption} className="text-xs font-semibold text-brand-600 hover:underline">+ Add option</button>
                )}
              </div>
            </>
          )}

          {form.type === "short" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Accepted answers (one per line)</span>
              <textarea rows={3} placeholder={"def\ndef keyword"} value={form.accepted} onChange={(e) => setForm({ ...form, accepted: e.target.value })} className={inputClass} />
              <span className="mt-1 block text-xs text-slate-400">
                Capital letters and extra spaces are ignored. Punctuation matters, so list variants separately (for example len and len()).
              </span>
            </label>
          )}

          {form.type !== "mcq" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Model answer / marking guide <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <textarea rows={3} value={form.model_answer} onChange={(e) => setForm({ ...form, model_answer: e.target.value })} className={inputClass} />
              {form.type === "theory" && <span className="mt-1 block text-xs text-slate-400">Theory answers are marked by you in the Marking tab.</span>}
            </label>
          )}

          <label className="flex items-center gap-2">Marks
            <input type="number" min={1} value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} className="w-20 rounded-lg border border-slate-300 px-2 py-1" />
          </label>
          <Button>Add question</Button>
        </form>
      </Card>
    </div>
  );
}

function Import({ testId, onDone }) {
  const [file, setFile] = useState(null);
  const [inputKey, setInputKey] = useState(0); // changing the key clears the file picker
  const [res, setRes] = useState(null);
  const [errors, setErrors] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (dry) => {
    setBusy(true); setError(""); setErrors([]); setRes(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const r = await api(`/admin/tests/${testId}/import?dry_run=${dry}`, { method: "POST", form });
      setRes(r);
      setErrors(r.errors || []);
      if (!dry) { onDone(); setFile(null); setInputKey((k) => k + 1); }
    } catch (e) {
      setError(e.message);
      setErrors(e.errors || []);
    } finally { setBusy(false); }
  };

  return (
    <Card className="max-w-2xl">
      <h2 className="font-semibold text-slate-900">Import questions from CSV or Excel</h2>
      <p className="mt-1 text-sm text-slate-500">
        Columns: <code>question, option_a … option_f, correct, marks</code>. Check the file first, then import.
      </p>
      <Button variant="ghost" className="mt-2 -ml-3" onClick={() => download("/admin/import-template", "import-template.csv").catch((e) => setError(e.message))}>
        ⬇ Download template
      </Button>
      <input key={inputKey} type="file" accept=".csv,.xlsx" className="my-3 block text-sm text-blue-600 hover:text-blue-800 visited:text-purple-600" onChange={(e) => { setFile(e.target.files[0]); setRes(null); setErrors([]); }} />
      <div className="flex gap-2">
        <Button variant="outline" disabled={!file || busy} onClick={() => run(true)}>Check file</Button>
        <Button disabled={!file || busy} onClick={() => run(false)}>Import</Button>
      </div>
      <div className="mt-4 space-y-2">
        <Alert>{error}</Alert>
        {res && !errors.length && (
          <Alert type="ok">{res.dry_run ? `File is valid — ${res.valid_count} question(s) ready to import.` : `Imported ${res.imported} question(s).`}</Alert>
        )}
        {errors.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {errors.map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}
          </ul>
        )}
      </div>
    </Card>
  );
}

function Reports({ testId }) {
  const [view, setView] = useState("open"); // "open" or "resolved"
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const load = () =>
    api(`/admin/tests/${testId}/reports?resolved=${view === "resolved"}`).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [testId, view]);

  const resolve = async (id) => {
    try { await api(`/admin/reports/${id}/resolve`, { method: "POST" }); load(); }
    catch (e) { setError(e.message); }
  };

  const pill = (v, label) => (
    <button onClick={() => setView(v)}
      className={`rounded-full px-3 py-1 text-xs font-semibold ${view === v ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
      {label}
    </button>
  );

  if (!rows) return error ? <Alert>{error}</Alert> : <Spinner />;
  return (
    <div className="space-y-3">
      <div className="flex gap-2">{pill("open", "Open")}{pill("resolved", "Resolved")}</div>
      <Alert>{error}</Alert>
      {rows.map((r) => (
        <Card key={r.id} className="flex items-start justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium text-slate-900">{r.question_text}</p>
            <p className="mt-1 text-slate-600">“{r.reason}”</p>
            <p className="mt-1 text-xs text-slate-400">{r.reporter_name} · {fmtDate(r.created_at)}</p>
            {!r.question_active && (
              <div className="mt-2"><Badge tone="gold">This version was already replaced or removed</Badge></div>
            )}
          </div>
          {r.resolved ? <Badge tone="green">Resolved</Badge> : <Button variant="outline" onClick={() => resolve(r.id)}>Mark resolved</Button>}
        </Card>
      ))}
      {rows.length === 0 && (
        <Card className="text-center text-sm text-slate-500">{view === "open" ? "No open reports." : "No resolved reports yet."}</Card>
      )}
    </div>
  );
}

function Results({ testId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/admin/tests/${testId}/results`).then(setData).catch((e) => setError(e.message)); }, [testId]);

  if (!data) return error ? <Alert>{error}</Alert> : <Spinner />;
  const s = data.summary;
  const pct = (v) => (v != null ? `${v.toFixed(1)}%` : null);
  const stat = (label, v) => (
    <Card className="text-center"><div className="text-2xl font-bold text-brand-700">{v ?? "—"}</div><div className="text-xs text-slate-500">{label}</div></Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {stat("Registered in course", s.course_participants)}
        {stat("Completed", s.taken)}
        {stat("Awaiting marking", s.awaiting_marking)}
        {stat("In progress", s.in_progress)}
        {stat("Not started", s.not_started)}
        {stat("Pass rate", s.pass_rate != null ? `${s.pass_rate.toFixed(0)}%` : null)}
        {stat("Passed / Failed", `${s.passed} / ${s.failed}`)}
        {stat("Average", pct(s.average_percentage))}
        {stat("Highest", pct(s.highest_percentage))}
        {stat("Lowest", pct(s.lowest_percentage))}
      </div>

      <div className="flex gap-2">
        {["xlsx", "csv", "pdf"].map((f) => (
          <Button key={f} variant="outline" onClick={() => download(`/admin/tests/${testId}/results/export?format=${f}`, `results.${f}`).catch((e) => setError(e.message))}>
            Export {f.toUpperCase()}
          </Button>
        ))}
      </div>
      <Alert>{error}</Alert>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Participant</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">%</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Time (min)</th><th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.results.map((r) => (
              <tr key={r.attempt_id}>
                <td className="px-4 py-3"><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.email}</div></td>
                <td className="px-4 py-3">{r.status.replace("_", " ")}</td>
                <td className="px-4 py-3">{r.score != null ? `${r.score}/${r.total_marks}` : "—"}</td>
                <td className="px-4 py-3">{r.percentage != null ? r.percentage.toFixed(1) : "—"}</td>
                <td className="px-4 py-3">{r.passed == null ? (r.pending_marking > 0 ? <Badge tone="gold">Marking pending</Badge> : "—") : <Badge tone={r.passed ? "green" : "red"}>{r.passed ? "Pass" : "Fail"}</Badge>}</td>
                <td className="px-4 py-3">{r.time_taken_minutes != null ? r.time_taken_minutes : "—"}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(r.submitted_at)}</td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No attempts yet.</td></tr>}
          </tbody>
        </table>
      </Card>

      {data.not_taken.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Not taken ({data.not_taken.length})</h3>
          <p className="text-sm text-slate-500">{data.not_taken.map((p) => p.name).join(", ")}</p>
        </Card>
      )}
    </div>
  );
}

function Settings({ test, onSaved }) {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(() => ({
    course_id: String(test.course_id),
    title: test.title,
    description: test.description || "",
    duration_minutes: test.duration_minutes,
    pass_mark: test.pass_mark,
    num_questions: test.num_questions,
    opens_at: toLocalInput(test.opens_at),
    closes_at: toLocalInput(test.closes_at),
    show_review: test.show_review,
  }));
  const [error, setError] = useState("");
  const [problems, setProblems] = useState([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/courses").then(setCourses).catch(() => {}); }, []);

  const set = (k) => (e) => {
    setSaved(false);
    setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setProblems([]); setSaved(false);
    try {
      const updated = await api(`/admin/tests/${test.id}`, {
        method: "PUT",
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
      onSaved(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
      setProblems(err.problems);
    } finally { setBusy(false); }
  };

  return (
    <Card className="max-w-3xl">
      <h2 className="mb-1 font-semibold text-slate-900">Test settings</h2>
      {test.attempt_count > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Participants have already taken this test. Duration and question count only affect new attempts. Changing the
          pass mark changes pass/fail on existing results. The course can no longer be changed.
        </p>
      )}
      <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
        <Field label="Title" required className="md:col-span-2" value={form.title} onChange={set("title")} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Course</span>
          <select required value={form.course_id} onChange={set("course_id")} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
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
        <div className="space-y-2 md:col-span-2">
          <Alert>{error}</Alert>
          <Problems items={problems} />
          {saved && <Alert type="ok">Settings saved.</Alert>}
          <Button disabled={busy}>{busy ? "Saving…" : "Save settings"}</Button>
        </div>
      </form>
    </Card>
  );
}
