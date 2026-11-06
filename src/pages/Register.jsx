import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Alert, AuthShell, Button, Field } from "../components/ui.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", course_id: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/courses").then(setCourses).catch((e) => setError(e.message));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register({ ...form, course_id: Number(form.course_id) });
      navigate("/tests");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Register as a participant to take your course tests.">
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <Field label="Full name" required minLength={2} value={form.name} onChange={set("name")} />
        <Field label="Email" type="email" required value={form.email} onChange={set("email")} />
        <Field label="Password (min. 8 characters)" type="password" required minLength={8} value={form.password} onChange={set("password")} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Course</span>
          <select
            required
            value={form.course_id}
            onChange={set("course_id")}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Select your course…</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <Button className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">
        Already registered? <Link to="/login" className="font-semibold text-brand-600 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
