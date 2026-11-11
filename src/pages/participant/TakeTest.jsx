import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api.js";
import { Alert, Button, Spinner } from "../../components/ui.jsx";

const pad = (n) => String(n).padStart(2, "0");
const clock = (s) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SAVE_LABEL = {
  idle: "",
  saving: "Saving…",
  saved: "All answers saved",
  error: "Last change not saved",
};

export default function TakeTest() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({}); // question_id -> { selected, flagged }
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const endsAt = useRef(0);
  const submitted = useRef(false);
  const answersRef = useRef({}); // always the latest answers, for use inside async code
  const seq = useRef({}); // per question: counts clicks so an older save can't overwrite a newer one
  const pending = useRef(0); // saves currently in flight
  const textTimers = useRef({}); // per question: the timer that saves typed text shortly after typing stops
  const unsavedText = useRef({}); // per question: typed text that has not been sent yet

  // The server answers 409 (with the attempt id) when time is up or the test is already finished.
  const flushAllRef = useRef(async () => {});

  const goToResult = useCallback(
    () => navigate(`/attempts/${attemptId}/result`, { replace: true }),
    [navigate, attemptId]
  );

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    api(`/attempts/${attemptId}`)
      .then((a) => {
        if (a.status !== "in_progress") return goToResult();
        setAttempt(a);
        endsAt.current = Date.now() + a.seconds_remaining * 1000; // server-corrected, not device clock
        setSecondsLeft(a.seconds_remaining);
        const map = {};
        a.questions.forEach(
          (q) => (map[q.question_id] = { selected: q.selected_option_id, text: q.text_answer || "", flagged: q.flagged_for_review })
        );
        setAnswers(map);
      })
      .catch((e) => {
        if (e.status === 409 && e.attemptId) return goToResult();
        setError(e.message);
      });
  }, [attemptId, goToResult]);

  const submit = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      await flushAllRef.current(); // typed text that hasn't been sent yet
      await api(`/attempts/${attemptId}/submit`, { method: "POST" });
      goToResult();
    } catch (e) {
      if (e.status === 409 && e.attemptId) return goToResult();
      submitted.current = false;
      setSubmitting(false);
      setError(e.message);
    }
  }, [attemptId, goToResult]);

  useEffect(() => {
    if (!attempt) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round((endsAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) submit();
    }, 1000);
    return () => clearInterval(id);
  }, [attempt, submit]);

  // Sends one change to the server. Retries a couple of times if the network drops,
  // unless the participant has meanwhile clicked something newer on the same question.
  const sendWithRetry = async (qid, mySeq, body) => {
    for (let tryNo = 1; ; tryNo++) {
      try {
        return await api(`/attempts/${attemptId}/answers`, { method: "PUT", body });
      } catch (e) {
        if (seq.current[qid] !== mySeq) return null; // superseded: the newer click owns the state
        const transient = e.status === 0 || e.status >= 500;
        if (!transient || tryNo >= 3) throw e;
        await sleep(1000 * tryNo);
        if (seq.current[qid] !== mySeq) return null;
      }
    }
  };

  const save = async (qid, patch) => {
    const mySeq = (seq.current[qid] = (seq.current[qid] || 0) + 1);
    const prev = answersRef.current[qid] || {};

    // Show the change immediately (functional update: never works from stale state)
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], ...patch } }));
    setSaveState("saving");
    pending.current += 1;

    const body = { question_id: qid };
    if ("selected" in patch) body.selected_option_id = patch.selected;
    if ("flagged" in patch) body.flagged_for_review = patch.flagged;
    if ("text" in patch) body.text_answer = patch.text;

    let result = null;
    let failure = null;
    try {
      result = await sendWithRetry(qid, mySeq, body);
    } catch (e) {
      failure = e;
    }
    pending.current -= 1;

    if (failure) {
      if (failure.status === 409 && failure.attemptId) return goToResult();
      if (seq.current[qid] !== mySeq) return;
      // Put back only what this click changed. Typed text stays on screen: the participant
      // would lose their writing, and the next keystroke triggers another save anyway.
      const undo = {};
      Object.keys(patch).filter((k) => k !== "text").forEach((k) => (undo[k] = prev[k]));
      if (Object.keys(undo).length) setAnswers((a) => ({ ...a, [qid]: { ...a[qid], ...undo } }));
      setSaveState("error");
      setError(failure.message);
    } else if (result !== null && pending.current === 0) {
      setSaveState("saved");
      setError("");
    }
  };

  // Typed answers: show the text at once, save ~0.8s after the participant stops typing
  const onTextChange = (qid, value) => {
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], text: value } }));
    unsavedText.current[qid] = value;
    setSaveState("saving");
    clearTimeout(textTimers.current[qid]);
    textTimers.current[qid] = setTimeout(() => flushText(qid), 800);
  };

  const flushText = async (qid) => {
    clearTimeout(textTimers.current[qid]);
    if (!(qid in unsavedText.current)) return;
    const value = unsavedText.current[qid];
    delete unsavedText.current[qid];
    await save(qid, { text: value });
  };

  flushAllRef.current = () => Promise.all(Object.keys(unsavedText.current).map((qid) => flushText(Number(qid))));

  const report = async (qid) => {
    const reason = prompt("What is wrong with this question?");
    if (!reason || reason.trim().length < 3) return;
    try {
      await api(`/attempts/${attemptId}/report`, { method: "POST", body: { question_id: qid, reason } });
      alert("Thanks — the question has been reported to the admin.");
    } catch (e) {
      if (e.status === 409 && e.attemptId) return goToResult();
      setError(e.message);
    }
  };

  if (!attempt) return error ? <Alert>{error}</Alert> : <Spinner />;

  const qs = attempt.questions;
  const q = qs[current];
  const a = answers[q.question_id] || {};
  const isAnswered = (x) => x && (x.selected != null || (x.text || "").trim() !== "");
  const answered = Object.values(answers).filter(isAnswered).length;
  const goTo = (i) => {
    flushText(q.question_id); // Safari doesn't blur the text box when a button is clicked
    setCurrent(i);
  };
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
          <div className="text-xs text-slate-500">
            {answered} of {qs.length} answered
            {SAVE_LABEL[saveState] && (
              <>
                {" · "}
                <span className={saveState === "error" ? "font-semibold text-red-600" : ""}>{SAVE_LABEL[saveState]}</span>
              </>
            )}
          </div>
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

          {q.question_type === "mcq" || !q.question_type ? (
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
          ) : (
            <div className="mt-5">
              {q.question_type === "short" ? (
                <input
                  value={a.text || ""}
                  maxLength={q.max_chars}
                  onChange={(e) => onTextChange(q.question_id, e.target.value)}
                  onBlur={() => flushText(q.question_id)}
                  placeholder="Type your answer"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              ) : (
                <textarea
                  value={a.text || ""}
                  maxLength={q.max_chars}
                  rows={12}
                  onChange={(e) => onTextChange(q.question_id, e.target.value)}
                  onBlur={() => flushText(q.question_id)}
                  placeholder="Write your answer here"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm leading-relaxed outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              )}
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>{q.question_type === "theory" ? "This answer will be marked by your instructor after the test." : "Marked automatically when you submit."}</span>
                <span>{(a.text || "").length} / {q.max_chars}</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save(q.question_id, { flagged: !a.flagged })}>
                {a.flagged ? "★ Flagged" : "☆ Flag for review"}
              </Button>
              <Button variant="ghost" onClick={() => report(q.question_id)}>Report question</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={current === 0} onClick={() => goTo(current - 1)}>Previous</Button>
              {current < qs.length - 1 ? (
                <Button onClick={() => goTo(current + 1)}>Next</Button>
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
                : isAnswered(s) ? "bg-brand-100 text-brand-700"
                : "bg-slate-100 text-slate-600";
              return (
                <button key={x.question_id} onClick={() => goTo(i)} className={`h-9 rounded-md text-xs font-semibold ${cls}`}>
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
