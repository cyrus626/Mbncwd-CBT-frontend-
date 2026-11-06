import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { Alert, Button, Spinner } from "../../components/ui.jsx";

const pad = (n) => String(n).padStart(2, "0");
const clock = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

export default function TakeTest() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({}); // question_id -> { selected, flagged }
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const endsAt = useRef(0);
  const submitted = useRef(false);

  useEffect(() => {
    api(`/attempts/${attemptId}`)
      .then((a) => {
        if (a.status !== "in_progress") return navigate(`/attempts/${attemptId}/result`, { replace: true });
        setAttempt(a);
        endsAt.current = Date.now() + a.seconds_remaining * 1000; // server-corrected, not device clock
        setSecondsLeft(a.seconds_remaining);
        const map = {};
        a.questions.forEach((q) => (map[q.question_id] = { selected: q.selected_option_id, flagged: q.flagged_for_review }));
        setAnswers(map);
      })
      .catch((e) => setError(e.message));
  }, [attemptId, navigate]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      await api(`/attempts/${attemptId}/submit`, { method: "POST" });
      navigate(`/attempts/${attemptId}/result`, { replace: true });
    } catch (e) {
      submitted.current = false;
      setSubmitting(false);
      setError(e.message);
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    if (!attempt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) submit();
    }, 1000);
    return () => clearInterval(id);
  }, [attempt, submit]);

  const save = async (qid, patch) => {
    const prev = answers[qid];
    const next = { ...prev, ...patch };
    setAnswers({ ...answers, [qid]: next });
    try {
      const body = { question_id: qid };
      if ("selected" in patch) body.selected_option_id = patch.selected;
      if ("flagged" in patch) body.flagged_for_review = patch.flagged;
      await api(`/attempts/${attemptId}/answers`, { method: "PUT", body });
    } catch (e) {
      setAnswers((a) => ({ ...a, [qid]: prev }));
      setError(e.message);
    }
  };

  const report = async (qid) => {
    const reason = prompt("What is wrong with this question?");
    if (!reason || reason.trim().length < 3) return;
    try {
      await api(`/attempts/${attemptId}/report`, { method: "POST", body: { question_id: qid, reason } });
      alert("Thanks — the question has been reported to the admin.");
    } catch (e) {
      setError(e.message);
    }
  };

  if (!attempt) return error ? <Alert>{error}</Alert> : <Spinner />;

  const qs = attempt.questions;
  const q = qs[current];
  const a = answers[q.question_id] || {};
  const answered = Object.values(answers).filter((x) => x.selected != null).length;
  const urgent = secondsLeft <= 300;

  const finish = () => {
    const left = qs.length - answered;
    const msg = left ? `You still have ${left} unanswered question(s). Submit anyway?` : "Submit your test?";
    if (confirm(msg)) submit();
  };

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <div className="font-semibold text-slate-900">{attempt.test_title}</div>
          <div className="text-xs text-slate-500">{answered} of {qs.length} answered</div>
        </div>
        <div className={`rounded-lg px-4 py-2 font-mono text-lg font-bold ${urgent ? "bg-red-100 text-red-700" : "bg-brand-50 text-brand-700"}`}>
          {clock(secondsLeft)}
        </div>
      </div>

      <Alert>{error}</Alert>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between text-sm text-slate-500">
            <span>Question {current + 1} of {qs.length}</span>
            <span>{q.marks} mark{q.marks > 1 ? "s" : ""}</span>
          </div>
          <p className="whitespace-pre-wrap text-lg font-medium text-slate-900">{q.text}</p>

          <div className="mt-5 space-y-3">
            {q.options.map((o, i) => {
              const on = a.selected === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => save(q.question_id, { selected: on ? null : o.id })}
                  className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                    on ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:border-brand-500/50 hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${on ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="pt-0.5">{o.text}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save(q.question_id, { flagged: !a.flagged })}>
                {a.flagged ? "★ Flagged" : "☆ Flag for review"}
              </Button>
              <Button variant="ghost" onClick={() => report(q.question_id)}>Report question</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={current === 0} onClick={() => setCurrent(current - 1)}>Previous</Button>
              {current < qs.length - 1 ? (
                <Button onClick={() => setCurrent(current + 1)}>Next</Button>
              ) : (
                <Button variant="gold" disabled={submitting} onClick={finish}>Submit test</Button>
              )}
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-slate-700">Question navigator</div>
          <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
            {qs.map((x, i) => {
              const s = answers[x.question_id] || {};
              const cls = i === current
                ? "bg-brand-700 text-white"
                : s.flagged ? "bg-amber-200 text-amber-900"
                : s.selected != null ? "bg-brand-100 text-brand-700"
                : "bg-slate-100 text-slate-600";
              return (
                <button key={x.question_id} onClick={() => setCurrent(i)} className={`h-9 rounded-md text-xs font-semibold ${cls}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 text-xs text-slate-500">
            <div><span className="mr-2 inline-block h-3 w-3 rounded bg-brand-100" />Answered</div>
            <div><span className="mr-2 inline-block h-3 w-3 rounded bg-amber-200" />Flagged</div>
            <div><span className="mr-2 inline-block h-3 w-3 rounded bg-slate-100" />Not answered</div>
          </div>
          <Button variant="gold" className="mt-4 w-full" disabled={submitting} onClick={finish}>
            {submitting ? "Submitting…" : "Submit test"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
