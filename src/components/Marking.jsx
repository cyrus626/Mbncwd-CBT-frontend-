import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Alert, Badge, Button, Card, Spinner } from "./ui.jsx";

const typeLabel = { short: "Short answer", theory: "Theory" };
const typeTone = { short: "gold", theory: "green" };
const inputClass =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

/**
 * The marking tab of a test: pick a short-answer or theory question on the left,
 * then mark everyone's answer to it on the right.
 */
export default function Marking({ testId }) {
  const [questions, setQuestions] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const loadOverview = () =>
    api(`/admin/tests/${testId}/marking`).then(setQuestions).catch((e) => setError(e.message));
  useEffect(() => { loadOverview(); }, [testId]);

  if (!questions) return error ? <Alert>{error}</Alert> : <Spinner />;

  if (questions.length === 0) {
    return (
      <Card className="text-center text-sm text-slate-500">
        Nothing to mark yet. Short-answer and theory questions show up here once participants have submitted answers to them.
      </Card>
    );
  }

  const totalPending = questions.reduce((n, q) => n + q.pending, 0);
  const activeId = selected ?? (questions.find((q) => q.pending > 0) || questions[0]).question_id;
  const current = questions.find((q) => q.question_id === activeId);

  return (
    <div className="space-y-4">
      <Alert>{error}</Alert>
      <p className="text-sm text-slate-600">
        {totalPending > 0
          ? <><b>{totalPending}</b> theory answer{totalPending > 1 ? "s" : ""} waiting for a mark. Participants see a provisional result until you finish.</>
          : "All theory answers are marked."}
      </p>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-2">
          {questions.map((q) => (
            <button
              key={q.question_id}
              onClick={() => setSelected(q.question_id)}
              className={`block w-full rounded-lg border px-3 py-3 text-left text-sm transition ${
                q.question_id === activeId ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge tone={typeTone[q.question_type]}>{typeLabel[q.question_type]}</Badge>
                {!q.is_active && <Badge tone="gray">Older version</Badge>}
                {q.pending > 0 && <Badge tone="gold">{q.pending} to mark</Badge>}
              </div>
              <div className="line-clamp-2 font-medium text-slate-900">{q.text}</div>
              <div className="mt-1 text-xs text-slate-500">{q.answered} answer{q.answered === 1 ? "" : "s"} · {q.marks} mark{q.marks > 1 ? "s" : ""}</div>
            </button>
          ))}
        </div>

        <Answers key={current.question_id} question={current} onChanged={loadOverview} />
      </div>
    </div>
  );
}

function Answers({ question, onChanged }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [onlyPending, setOnlyPending] = useState(question.question_type === "theory");
  const [touched, setTouched] = useState({}); // rows saved in this visit stay visible

  useEffect(() => {
    api(`/admin/questions/${question.question_id}/answers`).then(setRows).catch((e) => setError(e.message));
  }, [question.question_id]);

  const replace = (updated) => {
    setRows((rs) => rs.map((r) => (r.attempt_id === updated.attempt_id ? updated : r)));
    setTouched((t) => ({ ...t, [updated.attempt_id]: true }));
    onChanged();
  };

  if (!rows) return error ? <Alert>{error}</Alert> : <Spinner />;

  const pendingCount = rows.filter((r) => r.needs_marking).length;
  const shown = onlyPending ? rows.filter((r) => r.needs_marking || touched[r.attempt_id]) : rows;

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={typeTone[question.question_type]}>{typeLabel[question.question_type]}</Badge>
          <span className="text-xs text-slate-500">{question.marks} mark{question.marks > 1 ? "s" : ""}</span>
        </div>
        <p className="whitespace-pre-wrap font-medium text-slate-900">{question.text}</p>
        {question.accepted_answers?.length > 0 && (
          <p className="mt-3 text-sm text-slate-600"><span className="font-semibold">Accepted answers:</span> {question.accepted_answers.join(" · ")}</p>
        )}
        {question.model_answer && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Model answer / marking guide</div>
            <p className="whitespace-pre-wrap text-slate-700">{question.model_answer}</p>
          </div>
        )}
        {question.question_type === "short" && (
          <p className="mt-3 text-xs text-slate-500">
            Short answers are marked automatically. If a good answer was marked wrong because it was worded differently,
            give it the mark it deserves here.
          </p>
        )}
      </Card>

      <div className="flex gap-2">
        <button
          onClick={() => setOnlyPending(true)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${onlyPending ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          Needs marking ({pendingCount})
        </button>
        <button
          onClick={() => setOnlyPending(false)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${!onlyPending ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
        >
          All answers ({rows.length})
        </button>
      </div>

      <Alert>{error}</Alert>
      {shown.map((a) => <AnswerRow key={a.attempt_id} a={a} onSaved={replace} />)}
      {shown.length === 0 && (
        <Card className="text-center text-sm text-slate-500">
          {onlyPending ? "Everything for this question is marked." : "No answers yet."}
        </Card>
      )}
    </div>
  );
}

function AnswerRow({ a, onSaved }) {
  const [marks, setMarks] = useState(a.marks_awarded ?? "");
  const [feedback, setFeedback] = useState(a.feedback || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(!a.needs_marking);

  const valid = marks !== "" && Number(marks) >= 0 && Number(marks) <= a.max_marks && Number.isInteger(Number(marks));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const updated = await api(`/admin/answers/${a.attempt_id}/${a.question_id}/mark`, {
        method: "PUT",
        body: { marks: Number(marks), feedback: feedback.trim() || null },
      });
      setSaved(true);
      onSaved(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const edit = (setter) => (e) => {
    setSaved(false);
    setter(e.target.value);
  };

  return (
    <Card className={a.needs_marking && !saved ? "border-amber-300" : ""}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold text-slate-900">{a.participant_name}</span>
          <span className="ml-2 text-xs text-slate-400">{a.participant_email}</span>
        </div>
        {!a.marked_by_admin && a.marks_awarded != null && !a.needs_marking && (
          <Badge tone="gray">Automatic mark: {a.marks_awarded} / {a.max_marks}</Badge>
        )}
      </div>

      <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">{a.text_answer}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-end">
        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">Mark (out of {a.max_marks})</span>
          <div className="flex items-center gap-1">
            <input
              type="number" min={0} max={a.max_marks} value={marks} onChange={edit(setMarks)}
              className={`${inputClass} w-20`}
            />
            <button type="button" onClick={() => { setSaved(false); setMarks(0); }} className="rounded-md bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">0</button>
            <button type="button" onClick={() => { setSaved(false); setMarks(a.max_marks); }} className="rounded-md bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200">Full</button>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Comment for the participant (optional)</span>
          <input value={feedback} onChange={edit(setFeedback)} maxLength={2000} className={`${inputClass} w-full`} />
        </label>
        <div className="flex items-center gap-2">
          <Button disabled={!valid || busy || saved} onClick={save}>{busy ? "Saving…" : saved ? "Saved ✓" : "Save mark"}</Button>
        </div>
      </div>
      {error && <div className="mt-2"><Alert>{error}</Alert></div>}
    </Card>
  );
}
