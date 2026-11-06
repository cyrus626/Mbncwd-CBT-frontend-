import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import logo from "../assets/logo.png";

export function Button({ variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    gold: "bg-gold-500 text-brand-900 hover:bg-gold-400",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-brand-700 hover:bg-brand-50",
  };
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", ...props }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} {...props} />;
}

export function Field({ label, className = "", ...props }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        {...props}
      />
    </label>
  );
}

export function Alert({ type = "error", children }) {
  if (!children) return null;
  const s = type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-brand-100 bg-brand-50 text-brand-700";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${s}`}>{children}</div>;
}

export function Badge({ tone = "gray", children }) {
  const t = {
    gray: "bg-slate-100 text-slate-600",
    green: "bg-brand-100 text-brand-700",
    gold: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${t[tone]}`}>{children}</span>;
}

export function Spinner() {
  return <div className="py-16 text-center text-sm text-slate-500">Loading…</div>;
}

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "—";

export function Logo({ light = false }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logo}
        alt="MBNCWD logo"
        className="h-11 w-11 rounded-full bg-white object-cover ring-2 ring-gold-500"
      />
      <div className="leading-tight">
        <div className={`text-sm font-bold tracking-wide ${light ? "text-white" : "text-brand-700"}`}>MBNCWD</div>
        <div className={`text-[11px] ${light ? "text-brand-100" : "text-slate-500"}`}>CBT Portal</div>
      </div>
    </div>
  );
}

export function Layout({ children, wide = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const link = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-medium ${isActive ? "bg-white/15 text-white" : "text-brand-100 hover:text-white"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <div className="bg-gold-500 py-1 text-center text-xs font-medium text-brand-900">
        Maryam Babangida National Centre for Women Development, Abuja
      </div>
      <header className="bg-brand-700">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/"><Logo light /></Link>
          <nav className="flex items-center gap-1">
            {user?.role === "admin" ? (
              <NavLink to="/admin" className={link}>Tests</NavLink>
            ) : (
              <NavLink to="/tests" className={link}>My Tests</NavLink>
            )}
            <span className="mx-2 hidden text-sm text-brand-100 sm:inline">{user?.name}</span>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="rounded-md border border-white/30 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-8 ${wide ? "max-w-6xl" : "max-w-5xl"}`}>{children}</main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Maryam Babangida National Centre for Women Development, Abuja
      </footer>
    </div>
  );
}

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <Logo light />
        <div>
          <div className="mb-4 h-1 w-16 rounded bg-gold-500" />
          <h1 className="text-4xl font-bold leading-tight">
            A national centre of excellence for gender equity and sustainable women development.
          </h1>
          <p className="mt-4 max-w-md text-brand-100">
            Take your assessments online — securely, on time and within the premises of MBNCWD.
          </p>
        </div>
        <p className="text-xs text-brand-100">© {new Date().getFullYear()} MBNCWD, Abuja</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden"><Logo /></div>
          <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
