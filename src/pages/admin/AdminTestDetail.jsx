import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, download } from "../../api.js";
import { Alert, Badge, Button, Card, fmtDate, Spinner } from "../../components/ui.jsx";
import EditQuestion from "../../components/EditQuestion.jsx";

const tabs = ["Questions", "Import", "Reports", "Results"];
const blankQ = { text: "", marks: 1, options: [{ text: "", is_correct: true }, { text: "", is_correct: false }, { text: "", is_correct: false }, { text: "", is_correct: false }] };

export default function AdminTestDetail() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [tab, setTab] = useState("Questions");
  const [error, setError] = useState("");

  const loadTest = useCallback(
    () => api(`/admin/tests/${testId}`).then(setTest).catch((e) => setError(e.message)),
    [testId]
  );
  useEffect(() => { loadTest(); }, [loadTest]);

  const setStatus = async (status) => {
    setError("");
    try { setTest(await api(`/admin/tests/${testId}/status`, { method: "PATCH", body: { status } })); }
    catch (e) { setError(e.message); }
  };

  const remove = async () => {
    if (!confirm("Delete this test permanently?")) return;
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
          <Badge tone={{ draft: "gray", published: "green", archived: "gold" }[test.status]}>{test.status}</Badge>
          {test.status !== "published" && <Button onClick={() => setStatus("published")}>Publish</Button>}
          {test.status === "published" && <Button variant="outline" onClick={() => setStatus("archived")}>Archive</Button>}
          {test.status === "published" && <Button variant="outline" onClick={() => setStatus("draft")}>Unpublish</Button>}
          <Button variant="danger" onClick={remove}>Delete</Button>
        </div>
      </div>
      <Alert>{error}</Alert>

      <div className="my-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Questions" && <Questions testId={testId} onChange={loadTest} />}
      {tab === "Import" && <Import testId={testId} onDone={loadTest} />}
      {tab === "Reports" && <Reports testId={testId} />}
      {tab === "Results" && <Results testId={testId} />}
    </div>
  );
}

function Questions({ testId, onChange }) {
  const [qs, setQs] = useState(null);
  const [form, setForm] = useState(blankQ);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const load = () => api(`/admin/tests/${testId}/questions`).then(setQs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [testId]);

  const setOpt = (i, patch) =>
    setForm({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, ...patch } : patch.is_correct ? { ...o, is_correct: false } : o)) });

  const add = async (e) => {
    e.preventDefault();
    setError("");
    const options = form.options.filter((o) => o.text.trim());
    try {
      await api(`/admin/tests/${testId}/questions`, { method: "POST", body: { text: form.text, marks: Number(form.marks), options } });
      setForm(blankQ);
      load();
      onChange();
    } catch (err) { setError(err.message); }
  };

  const del = async (id) => {
    if (!confirm("Delete this question?")) return;
    try { await api(`/admin/questions/${id}`, { method: "DELETE" }); load(); onChange(); }
    catch (e) { setError(e.message); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {editing && <EditQuestion question={editing} onClose={() => setEditing(null)} onSaved={() => { load(); onChange(); }} />}
      <div className="space-y-3">
        <Alert>{error}</Alert>
        {!qs ? <Spinner /> : qs.map((q, n) => (
          <Card key={q.id}>
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-slate-900">{n + 1}. {q.text}</p>
              <div className="flex gap-2">
                <button onClick={() => setEditing(q)} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
                <button onClick={() => del(q.id)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button>
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {q.options.map((o) => (
                <li key={o.id} className={o.is_correct ? "font-semibold text-brand-700" : "text-slate-600"}>
                  {o.is_correct ? "✓" : "○"} {o.text}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">{q.marks} mark(s)</p>
          </Card>
        ))}
        {qs?.length === 0 && <Card className="text-center text-sm text-slate-500">No questions yet.</Card>}
      </div>

      <Card className="h-fit">
        <h2 className="mb-3 font-semibold text-slate-900">Add a question</h2>
        <form onSubmit={add} className="space-y-3 text-sm">
          <textarea required rows={3} placeholder="Question text" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500" />
          {form.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" checked={o.is_correct} onChange={() => setOpt(i, { is_correct: true })} title="Mark as correct" />
              <input placeholder={`Option ${String.fromCharCode(65 + i)}${i > 1 ? " (optional)" : ""}`} required={i < 2} value={o.text}
                onChange={(e) => setOpt(i, { text: e.target.value })}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500" />
            </div>
          ))}
          <p className="text-xs text-slate-400">Select the radio button beside the correct option.</p>
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
      if (!dry) { onDone(); setFile(null); }
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
      <Button variant="ghost" className="mt-2 -ml-3" onClick={() => download("/admin/import-template", "import-template.csv")}>
        ⬇ Download template
      </Button>
      <input type="file" accept=".csv,.xlsx" className="my-3 block text-sm" onChange={(e) => { setFile(e.target.files[0]); setRes(null); setErrors([]); }} />
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
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const load = () => api(`/admin/tests/${testId}/reports`).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [testId]);

  const resolve = async (id) => {
    try { await api(`/admin/reports/${id}/resolve`, { method: "POST" }); load(); }
    catch (e) { setError(e.message); }
  };

  if (!rows) return error ? <Alert>{error}</Alert> : <Spinner />;
  return (
    <div className="space-y-3">
      <Alert>{error}</Alert>
      {rows.map((r) => (
        <Card key={r.id} className="flex items-start justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium text-slate-900">{r.question_text}</p>
            <p className="mt-1 text-slate-600">“{r.reason}”</p>
            <p className="mt-1 text-xs text-slate-400">{r.reporter_name} · {fmtDate(r.created_at)}</p>
          </div>
          {r.resolved ? <Badge tone="green">Resolved</Badge> : <Button variant="outline" onClick={() => resolve(r.id)}>Mark resolved</Button>}
        </Card>
      ))}
      {rows.length === 0 && <Card className="text-center text-sm text-slate-500">No reported questions.</Card>}
    </div>
  );
}

function Results({ testId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/admin/tests/${testId}/results`).then(setData).catch((e) => setError(e.message)); }, [testId]);

  if (!data) return error ? <Alert>{error}</Alert> : <Spinner />;
  const s = data.summary;
  const stat = (label, v) => (
    <Card className="text-center"><div className="text-2xl font-bold text-brand-700">{v ?? "—"}</div><div className="text-xs text-slate-500">{label}</div></Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat("Registered in course", s.course_participants)}
        {stat("Completed", s.taken)}
        {stat("Not started", s.not_started)}
        {stat("Pass rate", s.pass_rate != null ? `${s.pass_rate.toFixed(0)}%` : null)}
        {stat("Average", s.average_percentage != null ? `${s.average_percentage.toFixed(1)}%` : null)}
        {stat("Highest", s.highest_percentage != null ? `${s.highest_percentage.toFixed(1)}%` : null)}
        {stat("Lowest", s.lowest_percentage != null ? `${s.lowest_percentage.toFixed(1)}%` : null)}
        {stat("Passed / Failed", `${s.passed} / ${s.failed}`)}
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
            <tr><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">%</th><th className="px-4 py-3">Result</th><th className="px-4 py-3">Submitted</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.results.map((r) => (
              <tr key={r.attempt_id}>
                <td className="px-4 py-3"><div className="font-medium">{r.name}</div><div className="text-xs text-slate-400">{r.email}</div></td>
                <td className="px-4 py-3">{r.status.replace("_", " ")}</td>
                <td className="px-4 py-3">{r.score != null ? `${r.score}/${r.total_marks}` : "—"}</td>
                <td className="px-4 py-3">{r.percentage != null ? r.percentage.toFixed(1) : "—"}</td>
                <td className="px-4 py-3">{r.passed == null ? "—" : <Badge tone={r.passed ? "green" : "red"}>{r.passed ? "Pass" : "Fail"}</Badge>}</td>
                <td className="px-4 py-3 text-slate-500">{fmtDate(r.submitted_at)}</td>
              </tr>
            ))}
            {data.results.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No attempts yet.</td></tr>}
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
