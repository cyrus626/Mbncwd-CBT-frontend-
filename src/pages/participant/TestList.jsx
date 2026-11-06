import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";
import { Alert, Badge, Button, Card, fmtDate, Spinner } from "../../components/ui.jsx";

export default function TestList() {
  const navigate = useNavigate();
  const [tests, setTests] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    api("/tests/available").then(setTests).catch((e) => setError(e.message));
  }, []);

  const start = async (id) => {
    if (!confirm("Start this test now? The timer begins immediately and cannot be paused.")) return;
    setBusyId(id);
    try {
      const attempt = await api(`/tests/${id}/start`, { method: "POST" });
      navigate(`/attempts/${attempt.attempt_id}`);
    } catch (e) {
      setError(e.message);
      setBusyId(null);
    }
  };

  if (!tests && !error) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Available tests</h1>
      <p className="mb-6 text-sm text-slate-500">Tests for your course appear here.</p>
      <Alert>{error}</Alert>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {tests?.map((t) => {
          const submitted = t.attempt_status && t.attempt_status !== "in_progress";
          return (
            <Card key={t.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-slate-900">{t.title}</h2>
                {submitted ? (
                  <Badge tone={t.passed ? "green" : "red"}>{t.passed ? "Passed" : "Failed"}</Badge>
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
                  <span className="text-sm text-slate-600">Score: <b>{t.score}/{t.total_marks}</b> ({t.percentage?.toFixed(1)}%)</span>
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
        })}
      </div>
      {tests?.length === 0 && <Card className="mt-4 text-center text-sm text-slate-500">No tests are available for your course yet.</Card>}
    </div>
  );
}
