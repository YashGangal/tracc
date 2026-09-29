import React, { useState } from "react";
import { LogIn, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { login, saveSession } from "../../lib/api";
import { TraccMark } from "./TraccMark";
import { PixelCanvasField } from "./PixelCanvasField";
import { DitheredLogo } from "../ui/dithered-logo";
import { usePrefersReducedMotion } from "../ui/dotmatrix-hooks";
import { cn } from "../../lib/utils";

interface LoginPageProps {
  onLogin: (session: { access_token: string; role: string; user_name: string; email: string; demo?: boolean }) => void;
}

const DEMO_ACCOUNTS: { email: string; password: string; role: string; badge: string; desc: string }[] = [
  { email: "alex.dispatcher@logistics.copilot", password: "dispatcher123", role: "Dispatcher", badge: "Active", desc: "Read & Query telemetry" },
  { email: "sarah.manager@logistics.copilot", password: "manager123", role: "Ops Manager", badge: "Write", desc: "Upload & Trigger dispatches" },
  { email: "admin@logistics.copilot", password: "admin123", role: "Admin", badge: "Root", desc: "Full fleet & agent permissions" },
  { email: "viewer@logistics.copilot", password: "viewer123", role: "Viewer", badge: "Read", desc: "Audit log review only" },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem("tracc_remember_email") || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [forgotNote, setForgotNote] = useState(false);
  // Interactive dithered brand mark. Falls back to the static asset when
  // the user prefers reduced motion, so the logo always stays intact.
  const reduceMotion = usePrefersReducedMotion();

  const RING =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0c]";

  async function loginAs(account: { email: string; password: string; role: string }) {
    setError("");
    setEmailErr("");
    setPwErr("");
    setLoading(true);
    setPendingRole(account.role);
    try {
      const data = await login(account.email, account.password);
      const session = {
        access_token: data.access_token,
        role: data.role,
        user_name: data.user_name,
        email: data.email || account.email,
      };
      saveSession(session);
      onLogin(session);
    } catch (err: any) {
      setError(
        err?.status === 401
          ? `Instant sign-in failed for ${account.role} — contact your ops admin.`
          : err?.message || "Login failed — check your connection and retry."
      );
    } finally {
      setLoading(false);
      setPendingRole(null);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEmailErr("");
    setPwErr("");
    const em = email.trim();
    let bad = false;
    if (!em) {
      setEmailErr("Enter your work email.");
      bad = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setEmailErr("That email doesn't look right — check for typos.");
      bad = true;
    }
    if (!password) {
      setPwErr("Enter your password.");
      bad = true;
    }
    if (bad) return;
    setLoading(true);
    try {
      const data = await login(em, password);
      const session = {
        access_token: data.access_token,
        role: data.role,
        user_name: data.user_name,
        email: data.email || email.trim(),
      };
      try {
        if (remember) localStorage.setItem("tracc_remember_email", email.trim());
        else localStorage.removeItem("tracc_remember_email");
      } catch {
        /* private mode */
      }
      saveSession(session);
      onLogin(session);
    } catch (err: any) {
      if (err?.status === 401) {
        setPwErr("Incorrect email or password. Check caps lock or ask your ops admin.");
      } else {
        setError(err?.message || "Login failed — check your connection and retry.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    {/* Brand decision: login is a fixed dark stage in both themes, so the
        hex surfaces below are intentional — do not migrate them to theme vars. */}
    <div className="min-h-screen bg-[#0a0a0c] text-neutral-100 relative overflow-hidden">
      {/* Full-bleed interactive pixel field */}
      <PixelCanvasField colors={["#3b82f6", "#22d3ee", "#22c55e"]} ambient={false} />
      {/* Dim the field behind the sign-in form for contrast + calm */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0a0a0c]/85"
      />

      <main className="relative z-10 grid lg:grid-cols-2 min-h-screen">
        {/* Left: brand zone over the live field (dithered treatment retired) */}
        <section className="hidden lg:flex flex-col justify-between p-10 xl:p-14" aria-label="Tracc operations console">
          <div className="flex items-center justify-between font-mono text-[11px] text-neutral-500">
            <span className="tracking-widest">TRACC // OPERATIONS CONSOLE</span>
            <LiveClock />
          </div>

          <div className="space-y-8 flex flex-col items-end">
            <div className="flex flex-col items-center text-center space-y-6">
            <div
              className="h-[280px] w-[280px] overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-black/10"
              role="img"
              aria-label="Tracc logo"
            >
              {reduceMotion ? (
                <img
                  src="/tracc-mark-login.svg"
                  alt=""
                  width={280}
                  height={280}
                  className="h-full w-full"
                  draggable={false}
                />
              ) : (
                <DitheredLogo
                  imageSrc="/tracc-mark-login.svg"
                  className="h-full w-full text-[#151515]"
                  gridSize={240}
                  scale={0.94}
                  dotScale={1}
                  accentColor="#2948f5"
                />
              )}
            </div>
            <div>
              <p className="font-extrabold tracking-tight text-6xl xl:text-7xl leading-[1.02]">
                Tracc
              </p>
              <p className="mt-3 text-base text-neutral-400 max-w-sm leading-relaxed">
                Predictive dispatch for freight operations.
              </p>
              <p className="mt-4 font-mono text-[11px] tracking-[0.18em] text-neutral-500">
                CHI → DAL · ATL → BOS · SEA → DEN
              </p>
            </div>
          </div>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-neutral-500" aria-hidden>
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              LIVE
            </span>
            <span>·</span>
            <span>491 CARRIERS ACTIVE</span>
            <span>·</span>
            <span>84.9% ON-TIME</span>
            <span>·</span>
            <span>10,000 LOADS / 14D</span>
          </div>
        </section>

        {/* Right: frosted glass sign-in over the same field */}
        <aside className="flex items-center justify-center p-4 sm:p-8" aria-label="Sign in">
          <h1 className="sr-only">Tracc — sign in to the operations console</h1>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101013]/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
            <header className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span className="grid place-items-center rounded-lg bg-white p-1 shadow ring-1 ring-black/10">
                  <TraccMark size={28} theme="dark" />
                </span>
                <span className="font-extrabold tracking-tight text-lg">Tracc</span>
              </span>
              <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-blue-400">
                AI OPS
              </span>
            </header>

            <h2 className="mt-6 text-[28px] font-bold tracking-tight">Welcome back.</h2>
            <p className="mt-1 text-sm text-neutral-400">Sign in to the operations console.</p>

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate aria-busy={loading}>
              <div>
                <div className="mb-1.5 flex min-h-[44px] items-center">
                  <label htmlFor="tracc-email" className="block text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">
                    Email
                  </label>
                </div>
                <input
                  id="tracc-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="username"
                  required
                  aria-required="true"
                  aria-invalid={emailErr ? true : undefined}
                  aria-describedby={emailErr ? "tracc-email-err" : undefined}
                  placeholder="you@company.com"
                  className={`w-full rounded-lg border bg-black/40 px-4 py-3 text-sm font-medium outline-none placeholder:text-neutral-400 ${RING} ${
                    emailErr ? "border-red-500/60" : "border-white/10 focus:border-blue-500/60"
                  }`}
                />
                {emailErr && (
                  <p id="tracc-email-err" role="alert" className="mt-1.5 text-[12px] font-medium text-red-300">
                    {emailErr}
                  </p>
                )}
              </div>
              <div>
                <div className="mb-1.5 flex min-h-[44px] items-center justify-between">
                  <label htmlFor="tracc-password" className="block text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setForgotNote((v) => !v)}
                    aria-expanded={forgotNote}
                    aria-controls="forgot-note"
                    className={`rounded text-[13px] font-medium text-blue-400 hover:underline ${RING}`}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="flex items-center rounded-lg border border-white/10 bg-black/40 px-4 focus-within:border-blue-500/60">
                  <input
                    id="tracc-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    aria-required="true"
                    aria-invalid={pwErr ? true : undefined}
                    aria-describedby={pwErr ? "tracc-pw-err" : undefined}
                    placeholder="••••••••••"
                    className={`w-full bg-transparent py-3 text-sm font-medium outline-none placeholder:text-neutral-400 ${RING} rounded`}
                  />
                  <button
                    type="button"
                    onClick={() => setShow(!show)}
                    className={`min-h-[44px] min-w-[44px] -mr-2 grid place-items-center rounded text-neutral-500 hover:text-neutral-200 ${RING}`}
                    aria-label={show ? "Hide password" : "Show password"}
                    aria-pressed={show}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {pwErr && (
                  <p id="tracc-pw-err" role="alert" className="mt-1.5 text-[12px] font-medium text-red-300">
                    {pwErr}
                  </p>
                )}
                {forgotNote && (
                  <p id="forgot-note" className="mt-1.5 text-[12px] leading-relaxed text-neutral-500">
                    No self-service reset on this console. Contact your operations admin with
                    your work email — resets are typically done within one shift.
                  </p>
                )}
              </div>
              {error && (
                <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] font-medium text-red-300">
                  {error}
                </p>
              )}
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-neutral-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded accent-blue-500"
                />
                Keep me signed in on this device
              </label>
              <button
                disabled={loading}
                aria-busy={loading}
                className={`flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3.5 text-[15px] font-bold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 ${RING}`}
              >
                {loading ? (
                  <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-400 border-t-neutral-950" />
                    Verifying…
                  </span>
                ) : (
                  <>Sign in to console <ArrowRight size={17} /></>
                )}
              </button>
            </form>

            <details className="mt-5 rounded-xl border border-dashed border-white/15 px-4 py-3">
              <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-widest text-neutral-500 hover:text-neutral-300">
                Try a demo role <span className="font-mono normal-case tracking-normal opacity-70">(demo only)</span>
              </summary>
              <div className="mt-2.5 grid grid-cols-1 min-[480px]:grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => {
                  const busy = pendingRole === a.role;
                  return (
                  <button
                    key={a.email}
                    onClick={() => loginAs(a)}
                    disabled={loading}
                    aria-label={`Sign in instantly as ${a.role} (${a.email})`}
                    aria-busy={busy}
                    className={`group relative min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-left transition hover:border-blue-500/40 hover:bg-white/10 disabled:opacity-60 ${RING}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-neutral-200">
                        {busy && (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-500 border-t-neutral-200" aria-hidden />
                        )}
                        {a.role}
                      </span>
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium",
                          a.badge === "Root"
                            ? "border-red-500/30 bg-red-500/10 text-red-300"
                            : a.badge === "Write"
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            : a.badge === "Active"
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                            : "border-white/15 bg-white/5 text-neutral-400"
                        )}
                      >
                        {busy ? "…" : a.badge}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-neutral-400">{a.email}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{a.desc}</span>
                    {/* Hover credential popover (decorative — credentials are on the button label) */}
                    <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-white/10 bg-[#141417] p-3 font-mono text-[11px] shadow-2xl opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <span className="block truncate text-neutral-300" title={a.email}>{a.email}</span>
                      <span className="mt-1 block tracking-[0.2em] text-neutral-500" aria-label="Password hidden">
                        {"•".repeat(12)}
                      </span>
                      <span className="mt-1 block text-[10px] uppercase tracking-widest text-emerald-400">
                        Click to sign in instantly
                      </span>
                    </span>
                  </button>
                  );
                })}
              </div>
            </details>

            <footer className="mt-5 flex items-center justify-between text-[11px] text-neutral-500">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-300">
                <ShieldCheck size={13} /> Human Approval Guard Active
              </span>
              <span className="font-mono">v2.4.1</span>
            </footer>
          </div>
        </aside>
      </main>
    </div>
    </>
  );
};

function LiveClock() {  const [now, setNow] = useState("--:-- UTC");
  React.useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setNow(
        reduce
          ? `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
          : `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`
      );
    };
    tick();
    const t = setInterval(tick, reduce ? 30000 : 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{now}</span>;
}

export default LoginPage;
