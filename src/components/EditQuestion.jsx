import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Alert, Button } from "./ui.jsx";

/**
 * Modal for editing an existing question.
 * Props:
 *   question  - the question object from GET /admin/tests/:id/questions
 *   onClose   - called when the modal is dismissed
 *   onSaved   - called after a successful save (refresh your list here)
 */
export default function EditQuestion({ question, onClose, onSaved }) {
  const [text, setText] = useState(question.text);
  const [marks, setMarks] = useState(question.marks);
  const [options, setOptions] = useState(
    question.options.map((o) => ({ text: o.text, is_correct: o.is_correct }))
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const setOpt = (i, patch) =>
    setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : patch.is_correct ? { ...o, is_correct: false } : o)));

  const addOption = () => options.length < 6 && setOptions([...options, { text: "", is_correct: false }]);

  const removeOption = (i) => {
    if (options.length <= 2) return;
    const next = options.filter((_, j) => j !== i);
    if (!next.some((o) => o.is_correct)) next[0].is_correct = true; // always keep one correct answer
    setOptions(next);
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/admin/questions/${question.id}`, {
        method: "PUT",
        body: { text, marks: Number(marks), options: options.map((o) => ({ ...o, text: o.text.trim() })) },
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between rounded-t-xl bg-brand-700 px-6 py-4">
          <h2 className="font-semibold text-white">Edit question</h2>
          <button onClick={onClose} className="text-2xl leading-none text-brand-100 hover:text-white" aria-label="Close">
            ×
          </button>
        </div>
        <div className="h-1 bg-gold-500" />

        <form onSubmit={save} className="space-y-4 p-6 text-sm">
          <Alert>{error}</Alert>

          <label className="block">
            <span className="mb-1 block font-medium text-slate-700">Question</span>
            <textarea
              required
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>

          <div>
            <span className="mb-1 block font-medium text-slate-700">Options</span>
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={o.is_correct}
                    onChange={() => setOpt(i, { is_correct: true })}
                    title="Mark as correct answer"
                    className="accent-[var(--color-brand-600)]"
                  />
                  <span className="w-5 text-xs font-bold text-slate-400">{String.fromCharCode(65 + i)}</span>
                  <input
                    required
                    value={o.text}
                    onChange={(e) => setOpt(i, { text: e.target.value })}
                    className={`flex-1 rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-100 ${
                      o.is_correct ? "border-brand-500 bg-brand-50" : "border-slate-300 focus:border-brand-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    className="px-2 text-lg text-slate-400 hover:text-red-600 disabled:opacity-30"
                    aria-label="Remove option"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-400">The selected radio button marks the correct answer.</p>
              {options.length < 6 && (
                <button type="button" onClick={addOption} className="text-xs font-semibold text-brand-600 hover:underline">
                  + Add option
                </button>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <span className="font-medium text-slate-700">Marks</span>
            <input
              type="number"
              min={1}
              max={100}
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              className="w-20 rounded-lg border border-slate-300 px-2 py-1"
            />
          </label>

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            If participants have already seen this question, saving creates a corrected version for future attempts.
            Past scores are not changed.
          </p>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
