import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Alert, Button, Card, Field } from "../components/ui.jsx";

const blank = { current: "", next: "", confirm: "" };

export default function Account() {
  const { user } = useAuth();
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    setDone(false);
    setForm({ ...form, [k]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setDone(false);
    if (form.next !== form.confirm) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { current_password: form.current, new_password: form.next },
      });
      setForm(blank);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">Account</h1>
      <p className="mb-6 text-sm text-slate-500">
        Signed in as <b>{user?.name}</b> ({user?.email})
      </p>

      <Card>
        <h2 className="mb-4 font-semibold text-slate-900">Change password</h2>
        <form onSubmit={submit} className="space-y-4">
          <Alert>{error}</Alert>
          {done && <Alert type="ok">Your password has been changed.</Alert>}
          <Field label="Current password" type="password" required autoComplete="current-password" value={form.current} onChange={set("current")} />
          <Field label="New password (min. 8 characters)" type="password" required minLength={8} autoComplete="new-password" value={form.next} onChange={set("next")} />
          <Field label="Repeat the new password" type="password" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
          <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Change password"}</Button>
        </form>
      </Card>
    </div>
  );
}
