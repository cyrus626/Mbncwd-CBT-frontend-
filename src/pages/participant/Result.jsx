import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { Alert, Badge, Card, fmtDate, Spinner } from "../../components/ui.jsx";

export default function Result() {
  const { attemptId } = useParams();
  const [r, setR] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/attempts/${attemptId}/result`).then(setR).catch((e) => setError(e.message));
  }, [attemptId]);

  if (error) return <Alert>{error}</Alert>;
  if (!r) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="text-center">
        <Badge tone={r.passed ? "green" : "red"}>{r.passed ? "PASSED" : "NOT PASSED"}</Badge>
        <h1 className="mt-3 text-xl font-bold text-slate-900">{r.test_title}</h1>
        <div className="my-5 text-6xl font-extrabold text-brand-700">{r.percentage.toFixed(1)}%</div>
        <p className="text-slate-600">
          You scored <b>{r.score}</b> out of <b>{r.total_marks}</b> · pass mark {r.pass_mark}%
        </p>
        <p className="mt-1 text-xs text-slate-400">Submitted {fmtDate(r.submitted_at)}</p>
        <Link to="/tests" className="mt-5 inline-block text-sm font-semibold text-brand-600 hover:underline">← Back to my tests</Link>
      </Card>

      {r.review && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Review</h2>
          {r.review.map((q) => (
            <Card key={q.question_id}>
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">{q.position}. {q.text}</p>
                <Badge tone={q.is_correct ? "green" : "red"}>{q.is_correct ? "Correct" : q.answered ? "Wrong" : "Skipped"}</Badge>
              </div>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
