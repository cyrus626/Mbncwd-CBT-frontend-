const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || [];
  }
}

export const getToken = () => localStorage.getItem("token");

function parseDetail(data) {
  const d = data?.detail;
  if (typeof d === "string") return { message: d };
  if (Array.isArray(d)) return { message: d.map((e) => e.msg?.replace("Value error, ", "")).join(". ") };
  if (d && typeof d === "object") return { message: d.message || "Request failed", errors: d.errors };
  return { message: "Something went wrong" };
}

export async function api(path, { method = "GET", body, form, raw = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload });
  } catch {
    throw new ApiError("Cannot reach the server. Is the backend running?", 0);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const { message, errors } = parseDetail(data);
    if (res.status === 401 && token && !path.startsWith("/auth/login")) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    throw new ApiError(message, res.status, errors);
  }
  if (res.status === 204) return null;
  return raw ? res : res.json();
}

export async function download(path, fallbackName) {
  const res = await api(path, { raw: true });
  const blob = await res.blob();
  const match = /filename="?([^"]+)"?/.exec(res.headers.get("Content-Disposition") || "");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match?.[1] || fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}
