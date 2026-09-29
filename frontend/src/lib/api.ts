// Session + apiFetch — single choke point for backend auth (mirrors /api/v1).
export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "/api/v1";

const KEY = "logix_copilot_session";

export interface Session {
  access_token: string;
  role: string;
  user_name: string;
  email: string;
  demo?: boolean;
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function authHeaders(): Record<string, string> {
  const s = getSession();
  // Demo sessions carry a local-only fake token — never send it (it would
  // 401 and trip the global auth:expired logout).
  if (!s?.access_token || s?.demo) return {};
  return { Authorization: `Bearer ${s.access_token}` };
}

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload: unknown = null) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch(
  path: string,
  opts: { method?: string; body?: unknown; formData?: FormData; headers?: Record<string, string>; signal?: AbortSignal } = {}
): Promise<any> {
  const { method = "GET", body, formData, headers = {}, signal } = opts;
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const h: Record<string, string> = { ...authHeaders(), ...headers };
  let payload: BodyInit | undefined;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(url, { method, headers: h, body: payload, signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new ApiError(-1, "Stopped");
    throw new ApiError(0, "Backend unreachable");
  }
  if (res.status === 401) {
    if (getSession()?.demo) throw new ApiError(0, "Backend unreachable");
    window.dispatchEvent(new CustomEvent("auth:expired"));
    let msg = "Session expired — please log in again";
    try {
      const j = await res.json();
      msg = j.detail || j.message || msg;
    } catch {
      /* non-JSON */
    }
    throw new ApiError(401, msg);
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    let data: any = null;
    try {
      data = await res.json();
      msg = data.detail || data.message || msg;
    } catch {
      if (res.status >= 500) throw new ApiError(0, "Backend unreachable");
    }
    throw new ApiError(res.status, msg, data);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export async function login(email: string, password: string): Promise<any> {
  return apiFetch("/auth/login", { method: "POST", body: { email, password } });
}

export function friendlyError(e: unknown): string {  if (e instanceof ApiError) {
    if (e.status === -1) return "Stopped";
    if (e.status === 0) return "Backend offline";
    if (e.status === 403) return "Forbidden — your role cannot do this";
    if (e.status === 404) return "Not found";
    if (e.status === 429) return "Too many requests — wait a moment and retry";
    if (e.status === 422) return "Invalid request — check inputs";
    if (e.status >= 500) return "Server error — try again";
    return e.message;
  }
  return "Something went wrong";
}
