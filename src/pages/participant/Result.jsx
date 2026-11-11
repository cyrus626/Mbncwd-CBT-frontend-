import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { Alert, Badge, Card, fmtDate, Spinner } from "../../components/ui.jsx";

function Marks({ item }) {
  if (item.awaiting_marking) return <Badge tone="gold">Awaiting marking</Badge>;
  if (item.marks_awarded == null) return null;
  const full = item.marks_awarded === item.marks;
  return <Badge tone={full ? "green" : item.marks_awarded > 0 ? "gold" : "red"}>{item.marks_awarded} / {item.marks}</Badge>;
}

function Typed({ item }) {
  return (
    <div className="space-y-2 text-sm">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Your answer</div>
        {item.text_answer ? (
          <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2">{item.text_answer}</p>
        ) : (
          <p className="text-slate-400">You didn't answer this question.</p>
        )}
      </div>
      {item.feedback && (
        <div className="rounded-md border border-brand-500/30 bg-brand-50 px-3 py-2">
          <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-brand-700">Feedback</div>
          <p className="whitespace-pre-wrap text-slate-700">{item.feedback}</p>
        </div>
      )}
    </div>
  );
}

export default function Result() {
  const { attemptId } = useParams();
  const [r, setR] = useState(null);
  const [error, setError] = useState("");
  const [reportError, setReportError] = useState("");
  const [reported, setReported] = useState({}); // question_id -> true once reported

  useEffect(() => {
    api(`/attempts/${attemptId}/result`).then(setR).catch((e) => setError(e.message));
  }, [attemptId]);

  const report = async (qid) => {
    const reason = prompt("What is wrong with this question?");
    if (!reason || reason.trim().length < 3) return;
    setReportError("");
    try {
      await api(`/attempts/${attemptId}/report`, { method: "POST", body: { question_id: qid, reason } });
      setReported((x) => ({ ...x, [qid]: true }));
    } catch (e) {
      setReportError(e.message);
    }
  };

  if (error) return <Alert>{error}</Alert>;
  if (!r) return <Spinner />;

  const reportButton = (qid) =>
    reported[qid] ? (
      <span className="text-xs font-semibold text-brand-700">Reported — thank you</span>
    ) : (
      <button onClick={() => report(qid)} className="text-xs font-semibold text-slate-500 hover:text-red-600 hover:underline">
        Report a problem with this question
      </button>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="text-center">
        {r.provisional ? (
          <Badge tone="gold">PROVISIONAL</Badge>
        ) : (
          <Badge tone={r.passed ? "green" : "red"}>{r.passed ? "PASSED" : "NOT PASSED"}</Badge>
        )}
        <h1 className="mt-3 text-xl font-bold text-slate-900">{r.test_title}</h1>
        <div className="my-5 text-6xl font-extrabold text-brand-700">{r.percentage.toFixed(1)}%</div>
        <p className="text-slate-600">
          {r.provisional ? "So far you have " : "You scored "}<b>{r.score}</b> out of <b>{r.total_marks}</b> · pass mark {r.pass_mark}%
        </p>
        {r.provisional && (
          <p className="mx-auto mt-3 max-w-md rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {r.pending_marking} written answer{r.pending_marking > 1 ? "s are" : " is"} still waiting to be marked.
            Your score may go up. Come back to this page later for your final result.
          </p>
        )}
        {r.status === "timed_out" && (
          <p className="mt-1 text-xs text-amber-700">Time ran out, so your saved answers were submitted automatically.</p>
        )}
        <p className="mt-1 text-xs text-slate-400">Submitted {fmtDate(r.submitted_at)}</p>
        <Link to="/tests" className="mt-5 inline-block text-sm font-semibold text-brand-600 hover:underline">← Back to my tests</Link>
      </Card>

      {/* Without the full review, still show marks and feedback for written answers */}
      {!r.review && r.written.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Your written answers</h2>
          <Alert>{reportError}</Alert>
          {r.written.map((w) => (
            <Card key={w.question_id}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">{w.position}. {w.text}</p>
                <Marks item={w} />
              </div>
              <Typed item={w} />
              <div className="mt-3 text-right">{reportButton(w.question_id)}</div>
            </Card>
          ))}
        </div>
      )}

      {r.review && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Review</h2>
          <Alert>{reportError}</Alert>
          {r.review.map((q) => (
            <Card key={q.question_id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">{q.position}. {q.text}</p>
                {q.question_type === "mcq" ? (
                  <Badge tone={q.is_correct ? "green" : "red"}>{q.is_correct ? "Correct" : q.answered ? "Wrong" : "Skipped"}</Badge>
                ) : (
                  <Marks item={q} />
                )}
              </div>

              {q.question_type === "mcq" ? (
                <ul className="space-y-2 text-sm">
                  {q.options.map((o) => (
                    <li key={o.id} className={`rounded-md border px-3 py-2 ${
                      o.is_correct ? "border-brand-500 bg-brand-50" : o.selected ? "border-red-300 bg-red-50" : "border-slate-200"
                    }`}>
                      {o.text}
                      {o.is_correct && <span className="ml-2 text-xs font-semibold text-brand-700">✓ correct answer</span>}
                      {o.selected && !o.is_correct && <span className="ml-2 text-xs font-semibold text-red-600">your answer</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="space-y-2">
                  <Typed item={q} />
                  {q.accepted_answers?.length > 0 && (
                    <p className="text-sm text-slate-600"><span className="font-semibold">Accepted answers:</span> {q.accepted_answers.join(" · ")}</p>
                  )}
                  {q.model_answer && (
                    <div className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                      <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Model answer</div>
                      <p className="whitespace-pre-wrap text-slate-700">{q.model_answer}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 text-right">{reportButton(q.question_id)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
