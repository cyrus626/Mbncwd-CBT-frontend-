import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { Alert, Badge, Button, Card, fmtDate, Spinner } from "../../components/ui.jsx";

const selectClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

export default function TestList() {
  const navigate = useNavigate();
  const [tests, setTests] = useState(null);
  const [mine, setMine] = useState([]); // my course memberships: active or pending
  const [allCourses, setAllCourses] = useState([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  // "Add another course" panel
  const [showJoin, setShowJoin] = useState(false);
  const [join, setJoin] = useState({ course_id: "", code: "" });
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinMessage, setJoinMessage] = useState("");

  const load = () =>
    Promise.all([api("/tests/available"), api("/my/courses"), api("/courses")])
      .then(([t, m, c]) => {
        setTests(t);
        setMine(m);
        setAllCourses(c);
      })
      .catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const start = async (id) => {
    if (!confirm("Start this test now? The timer begins immediately and cannot be paused.")) return;
    setBusyId(id);
    try {
      const attempt = await api(`/tests/${id}/start`, { method: "POST" });
      navigate(`/attempts/${attempt.attempt_id}`);
    } catch (e) {
      if (e.status === 409 && e.attemptId) return navigate(`/attempts/${e.attemptId}/result`);
      setError(e.message);
      setBusyId(null);
    }
  };

  const submitJoin = async (e) => {
    e.preventDefault();
    setJoining(true);
    setJoinError("");
    setJoinMessage("");
    try {
      const r = await api("/my/courses/join", {
        method: "POST",
        body: { course_id: Number(join.course_id), code: join.code },
      });
      setJoinMessage(
        r.status === "active"
          ? `You have joined ${r.course_name}. Its tests are listed below.`
          : `Request sent for ${r.course_name}. You'll see its tests as soon as the administrator approves you.`
      );
      setJoin({ course_id: "", code: "" });
      setShowJoin(false);
      await load();
    } catch (err) {
      setJoinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (!tests && !error) return <Spinner />;

  const pending = mine.filter((m) => m.status === "pending");
  const activeCount = mine.filter((m) => m.status === "active").length;
  const joinable = allCourses.filter((c) => !mine.some((m) => m.course_id === c.id));

  // Group the tests by course (headings only appear when there is more than one course)
  const groups = [];
  (tests || []).forEach((t) => {
    let g = groups.find((x) => x.id === t.course_id);
    if (!g) groups.push((g = { id: t.course_id, name: t.course_name, tests: [] }));
    g.tests.push(t);
  });

  const testCard = (t) => {
    const submitted = t.attempt_status && t.attempt_status !== "in_progress";
    return (
      <Card key={t.id} className="flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-slate-900">{t.title}</h3>
          {submitted ? (
            t.provisional ? (
              <Badge tone="gold">Marking pending</Badge>
            ) : (
              <Badge tone={t.passed ? "green" : "red"}>{t.passed ? "Passed" : "Failed"}</Badge>
            )
          ) : t.attempt_status === "in_progress" ? (
            <Badge tone="gold">In progress</Badge>
          ) : (
            <Badge tone={t.availability === "open" ? "green" : "gray"}>{t.availability}</Badge>
          )}
        </div>
        {t.description && <p className="mt-1 text-sm text-slate-500">{t.description}</p>}
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
          <div><dt>Duration</dt><dd className="font-semibold text-slate-800">{t.duration_minutes} min</dd></div>
          <div><dt>Questions</dt><dd className="font-semibold text-slate-800">{t.num_questions}</dd></div>
          <div><dt>Pass mark</dt><dd className="font-semibold text-slate-800">{t.pass_mark}%</dd></div>
        </dl>
        {(t.opens_at || t.closes_at) && (
          <p className="mt-2 text-xs text-slate-400">{fmtDate(t.opens_at)} → {fmtDate(t.closes_at)}</p>
        )}
        <div className="mt-4 flex-1" />
        {submitted ? (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">{t.provisional ? "Score so far" : "Score"}: <b>{t.score}/{t.total_marks}</b> ({t.percentage?.toFixed(1)}%)</span>
            <Link to={`/attempts/${t.attempt_id}/result`} className="text-sm font-semibold text-brand-600 hover:underline">View result</Link>
          </div>
        ) : t.attempt_status === "in_progress" ? (
          <Button onClick={() => navigate(`/attempts/${t.attempt_id}`)}>Resume test</Button>
        ) : (
          <Button disabled={t.availability !== "open" || busyId === t.id} onClick={() => start(t.id)}>
            {t.availability === "upcoming" ? "Not open yet" : t.availability === "closed" ? "Closed" : "Start test"}
          </Button>
        )}
      </Card>
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Available tests</h1>
          <p className="text-sm text-slate-500">
            {activeCount > 1 ? "Tests for all your courses appear here." : "Tests for your course appear here."}
          </p>
        </div>
        {joinable.length > 0 && (
          <Button variant="outline" onClick={() => { setShowJoin(!showJoin); setJoinError(""); }}>
            {showJoin ? "Cancel" : "+ Add another course"}
          </Button>
        )}
      </div>

      <div className="space-y-3">
        <Alert>{error}</Alert>
        <Alert type="ok">{joinMessage}</Alert>
        {pending.map((m) => (
          <div key={m.course_id} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your request to join <b>{m.course_name}</b> is waiting for the administrator's approval.
          </div>
        ))}
      </div>

      {showJoin && (
        <Card className="mt-4">
          <h2 className="mb-1 font-semibold text-slate-900">Add another course</h2>
          <p className="mb-3 text-sm text-slate-500">Choose the course and enter its access code. Ask your administrator or instructor if you don't have it.</p>
          <form onSubmit={submitJoin} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Course</span>
              <select required value={join.course_id} onChange={(e) => setJoin({ ...join, course_id: e.target.value })} className={selectClass}>
                <option value="">Select a course…</option>
                {joinable.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Access code</span>
              <input
                required minLength={4} autoComplete="off" placeholder="e.g. K7QM-2XHP" value={join.code}
                onChange={(e) => setJoin({ ...join, code: e.target.value })} className={selectClass}
              />
            </label>
            <Button disabled={joining}>{joining ? "Joining…" : "Join course"}</Button>
          </form>
          <div className="mt-3"><Alert>{joinError}</Alert></div>
        </Card>
      )}

      <div className="mt-6 space-y-8">
        {groups.map((g) => (
          <section key={g.id}>
            {activeCount > 1 && <h2 className="mb-3 text-lg font-semibold text-slate-800">{g.name}</h2>}
            <div className="grid gap-4 md:grid-cols-2">{g.tests.map(testCard)}</div>
          </section>
        ))}
      </div>

      {tests?.length === 0 && (
        <Card className="mt-4 text-center text-sm text-slate-500">
          {activeCount === 0 && pending.length > 0
            ? "Tests will appear here once your request is approved."
            : "No tests are available for your courses yet."}
        </Card>
      )}
    </div>
  );
}
