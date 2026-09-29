import React, { useState, useEffect, useCallback, Suspense, lazy } from "react";
import { flushSync } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Sidebar, NavSection } from "./components/dashboard/Sidebar";
import { TopBar } from "./components/dashboard/TopBar";
import { LoginPage } from "./components/dashboard/LoginPage";
import { ActivityFeed } from "./components/codedvisuals/ActivityFeed";
import { AnimatedLink } from "./components/codedvisuals/AnimatedLink";
import { GithubCard } from "./components/codedvisuals/GithubCard";
import { LinkedinCard } from "./components/codedvisuals/LinkedinCard";
import {
  initialKPIs,
  sampleLoads,
  sampleCarriers,
  sampleAlerts,
  sampleDocuments,
  sampleActivityFeed,
} from "./lib/mockData";
import { getSession, clearSession, type Session } from "./lib/api";
import {
  fetchKpis,
  fetchRevenueTrends,
  fetchLaneTrends,
  fetchLoads,
  fetchLoadDetail,
  fetchPrediction,
  fetchHighRisk,
  fetchTopCarriers,
  fetchAlerts,
  fetchDocuments,
  fetchBenchmark,
  normTopCarrier,
  applyPrediction,
  buildActivityFeed,
  resolveAlert as apiResolveAlert,
  triggerWorkflow as apiTriggerWorkflow,
  uploadDocument as apiUploadDocument,
  type TrendPoint,
  type LaneRow,
} from "./lib/backend";
import { LoadItem, CarrierItem, DocumentItem, MetricData, ActivityEvent } from "./lib/types";
import { Sparkles } from "lucide-react";

// Route-split heavy sections so the login/first paint never pays for
// charts, tables, and copilot code (A1: 942KB single bundle).
const KPICardGrid = lazy(() =>
  import("./components/dashboard/KPICardGrid").then((m) => ({ default: m.KPICardGrid }))
);
const LoadTrendChart = lazy(() =>
  import("./components/dashboard/LoadTrendChart").then((m) => ({ default: m.LoadTrendChart }))
);
const RiskPanel = lazy(() =>
  import("./components/dashboard/RiskPanel").then((m) => ({ default: m.RiskPanel }))
);
const CarrierLeaderboard = lazy(() =>
  import("./components/dashboard/CarrierLeaderboard").then((m) => ({ default: m.CarrierLeaderboard }))
);
const LoadDetailDrawer = lazy(() =>
  import("./components/dashboard/LoadDetailDrawer").then((m) => ({ default: m.LoadDetailDrawer }))
);
const CommandPalette = lazy(() =>
  import("./components/dashboard/CommandPalette").then((m) => ({ default: m.CommandPalette }))
);
const AICopilotView = lazy(() =>
  import("./components/dashboard/AICopilotView").then((m) => ({ default: m.AICopilotView }))
);
const KnowledgeBaseView = lazy(() =>
  import("./components/dashboard/KnowledgeBaseView").then((m) => ({ default: m.KnowledgeBaseView }))
);
const PredictionsView = lazy(() =>
  import("./components/dashboard/PredictionsView").then((m) => ({ default: m.PredictionsView }))
);
const AlertsCenterView = lazy(() =>
  import("./components/dashboard/AlertsCenterView").then((m) => ({ default: m.AlertsCenterView }))
);
const LoadsView = lazy(() =>
  import("./components/dashboard/LoadsView").then((m) => ({ default: m.LoadsView }))
);
const AnalyticsView = lazy(() =>
  import("./components/dashboard/AnalyticsView").then((m) => ({ default: m.AnalyticsView }))
);
const SettingsModal = lazy(() =>
  import("./components/dashboard/SettingsModal").then((m) => ({ default: m.SettingsModal }))
);

function SectionFallback() {
  return (
    <div className="p-4 sm:p-6 space-y-3" role="status" aria-label="Loading section">
      <div className="animate-pulse h-6 w-48 rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="animate-pulse h-32 w-full rounded-xl bg-neutral-100 dark:bg-neutral-800/60" />
      <div className="animate-pulse h-24 w-full rounded-xl bg-neutral-100 dark:bg-neutral-800/60" />
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("metrix_theme");
        if (stored === "light" || stored === "dark") return stored;
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
          return "light";
        }
      } catch (e) {}
    }
    return "dark";
  });
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [live, setLive] = useState(true);
  const [bootError, setBootError] = useState("");
  const [currentSection, setCurrentSection] = useState<NavSection>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePeriod, setActivePeriod] = useState("Trailing 14 days (live)");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedSeconds, setLastUpdatedSeconds] = useState(12);

  // Live domain state (mockData only as labeled offline fallback)
  const [metrics, setMetrics] = useState<MetricData & { inTransitLoads?: number }>(initialKPIs);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [lanes, setLanes] = useState<LaneRow[]>([]);
  const [loads, setLoads] = useState<LoadItem[]>(sampleLoads);
  const [highRisk, setHighRisk] = useState<LoadItem[]>([]);
  const [carriers, setCarriers] = useState<CarrierItem[]>(sampleCarriers);
  const [alerts, setAlerts] = useState(sampleAlerts);
  const [documents, setDocuments] = useState<DocumentItem[]>(sampleDocuments);
  const [benchmark, setBenchmark] = useState<any>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>(sampleActivityFeed);
  const [selectedLoad, setSelectedLoad] = useState<LoadItem | null>(null);

  // Navigation & Modals
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [riskThreshold, setRiskThreshold] = useState(75);
  const [copilotInitialQuery, setCopilotInitialQuery] = useState("");
  const [loadStatusFilter, setLoadStatusFilter] = useState("all");
  const [loadsReloadKey, setLoadsReloadKey] = useState(0);

  const role = session?.role || "viewer";
  const canManage = ["operations_manager", "admin"].includes(role);

  // Theme switch with a circular bubble reveal expanding from the click
  // point. Falls back to an instant switch without the API / with
  // reduced motion.
  const commitTheme = useCallback(
    (next: "dark" | "light", origin?: { x: number; y: number }) => {
      if (next === theme) return;
      const reduce =
        typeof window !== "undefined" &&
        !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const doc = document as Document & {
        startViewTransition?: (cb: () => void) => { ready: Promise<void> };
      };
      if (!origin || reduce || typeof doc.startViewTransition !== "function") {
        setTheme(next);
        return;
      }
      try {
        const transition = doc.startViewTransition(() => {
          flushSync(() => setTheme(next));
        });
        transition.ready
          .then(() => {
            const r = Math.hypot(
              Math.max(origin.x, window.innerWidth - origin.x),
              Math.max(origin.y, window.innerHeight - origin.y)
            );
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${origin.x}px ${origin.y}px)`,
                  `circle(${r}px at ${origin.x}px ${origin.y}px)`,
                ],
              },
              {
                duration: 650,
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
                pseudoElement: "::view-transition-new(root)",
              } as KeyframeAnimationOptions
            );
          })
          .catch(() => {});
      } catch {
        setTheme(next);
      }
    },
    [theme]
  );

  const themeFromEvent = useCallback(
    (next: "dark" | "light", e?: React.MouseEvent) => {
      commitTheme(next, e ? { x: e.clientX, y: e.clientY } : undefined);
    },
    [commitTheme]
  );

  const loadAll = useCallback(async () => {
    if (!getSession()) return;
    setIsRefreshing(true);
    setBootError("");
    try {
      const [k, tr, ln, ld, carriersTop, als, docs, bench] = await Promise.all([
        fetchKpis(),
        fetchRevenueTrends().catch(() => []),
        fetchLaneTrends().catch(() => []),
        fetchLoads({ limit: 200, offset: 0 }).catch(() => ({ items: [], total: null })),
        fetchTopCarriers(200).catch(() => []),
        fetchAlerts("all").catch(() => []),
        fetchDocuments().catch(() => []),
        fetchBenchmark().catch(() => null),
      ]);
      setMetrics(k);
      setTrends(tr);
      setLanes(ln);
      const items = ld.items.length > 0 ? ld.items : [];
      setLoads(items);
      setCarriers(carriersTop.map(normTopCarrier));
      setAlerts(als.length > 0 ? als : []);
      if (docs.length > 0) setDocuments(docs);
      setBenchmark(bench);
      setActivity(buildActivityFeed(als, items));
      // Merge live ML predictions into the visible loads.
      try {
        const preds = await fetchHighRisk(12);
        const byId = new Map<number, any>();
        preds.forEach((p: any) => {
          if (typeof p.load_id === "number") byId.set(p.load_id, p);
        });
        if (byId.size > 0) {
          const merged: LoadItem[] = [];
          for (const p of preds) {
            const existing = items.find((l) => l.dbId === p.load_id);
            if (existing) {
              merged.push(applyPrediction(existing, p));
            } else if (typeof p.load_id === "number") {
              try {
                const det = await fetchLoadDetail(p.load_id);
                const one = await fetchPrediction(p.load_id).catch(() => p);
                merged.push(applyPrediction(det, one));
              } catch {
                /* skip unscorable loads */
              }
            }
          }
          if (merged.length > 0) {
            setHighRisk(merged);
            setLoads((prev) => {
              const over = new Map(merged.map((m) => [m.id, m]));
              return prev.map((l) => over.get(l.id) || l);
            });
          }
        }
      } catch {
        /* predictions are best-effort; board stays usable */
      }
      setLive(true);
      setLastUpdatedSeconds(1);
    } catch (e: any) {
      setLive(false);
      setBootError(e?.message || "Backend unreachable — showing demo snapshot");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (session) loadAll();
  }, [session, loadAll]);

  useEffect(() => {
    const onExpired = () => {
      clearSession();
      setSession(null);
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  // Sync dark and light classes, data-theme, and colorScheme to html document element
  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
        root.setAttribute("data-theme", "dark");
        root.style.colorScheme = "dark";
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
        root.setAttribute("data-theme", "light");
        root.style.colorScheme = "light";
      }
      localStorage.setItem("metrix_theme", theme);
    } catch (e) {}
  }, [theme]);

  // Live timer simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdatedSeconds((prev) => (prev >= refreshInterval ? 1 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshInterval]);

  const handleManualRefresh = () => {
    loadAll();
  };

  async function openLoad(item: LoadItem) {
    setSelectedLoad(item);
    if (item.dbId == null) return;
    try {
      const [det, pred] = await Promise.all([
        fetchLoadDetail(item.dbId),
        fetchPrediction(item.dbId).catch(() => null),
      ]);
      setSelectedLoad(pred ? applyPrediction(det, pred) : det);
    } catch {
      /* keep list-level snapshot on detail failure */
    }
  }

  async function openLoadByDbId(dbId: number) {
    const found = loads.find((l) => l.dbId === dbId) || highRisk.find((l) => l.dbId === dbId);
    if (found) {
      openLoad(found);
      return;
    }
    try {
      const det = await fetchLoadDetail(dbId);
      const pred = await fetchPrediction(dbId).catch(() => null);
      setSelectedLoad(pred ? applyPrediction(det, pred) : det);
    } catch {
      /* unknown id */
    }
  }

  const handleResolveAlert = async (id: string) => {
    try {
      await apiResolveAlert(id);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
    } catch {
      /* surface stays honest: no optimistic flip on failure */
    }
  };

  const handleTriggerWorkflow = async (wf: "workflow_a" | "workflow_b" | "workflow_c") => {
    const res = await apiTriggerWorkflow(wf);
    const summary =
      res.report || (res.breach_list ? `${res.carriers_flagged} carrier(s) flagged` : res.alert_details ? `${res.alerts_created} alert(s) created` : "triggered");
    if (res.already_generated) return `${wf}: already generated — serving today's report`;
    const refreshed = await fetchAlerts("all").catch(() => []);
    if (refreshed.length > 0) {
      setAlerts(refreshed);
      setActivity(buildActivityFeed(refreshed, loads));
    }
    return `${wf} ok — ${summary}`;
  };

  const handleUploadDoc = async (file: File) => {
    await apiUploadDocument(file);
    const docs = await fetchDocuments().catch(() => []);
    if (docs.length > 0) setDocuments(docs);
  };

  const handleAskAIAboutLoad = (load: LoadItem) => {
    setSelectedLoad(null);
    setCopilotInitialQuery(`Why is load ${load.id} ${String(load.status).toLowerCase()} and what should I do?`);
    setCurrentSection("copilot");
  };

  const handleTriggerCopilotQuery = (query: string) => {
    setCopilotInitialQuery(query);
    setCurrentSection("copilot");
  };

  const handleSelectCarrier = (_carrier: CarrierItem) => {
    setCurrentSection("carriers");
  };

  const handleFilterLoadsByStatus = (status: string) => {
    const map: Record<string, string> = {
      all: "all",
      Delayed: "Delayed",
      Delivered: "Delivered",
    };
    setLoadStatusFilter(map[status] ?? "all");
    setLoadsReloadKey((k) => k + 1);
    setCurrentSection("loads");
  };

  const highRiskLoads = highRisk.length > 0 ? highRisk : loads.filter((l) => l.riskLevel === "High" || l.riskLevel === "Critical");
  const delayedLoads = loads.filter((l) => l.status === "Delayed");
  const carriersUnderReview = carriers.filter((c) => c.status === "Under Review");
  const unresolvedAlerts = alerts.filter((a) => !a.resolved);

  if (!session) {
    return <LoginPage onLogin={(s) => setSession(s)} />;
  }

  const teamUser = {
    id: "me",
    name: session.user_name || session.email,
    role: session.role,
    initials: (session.user_name || session.email || "U").slice(0, 2).toUpperCase(),
    status: "online" as const,
    color: "bg-blue-600",
  };

  return (
    <div className="min-h-screen bg-[#fbfbfb] dark:bg-[#09090b] text-neutral-900 dark:text-neutral-100 flex transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={(sec) => setCurrentSection(sec)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        highRiskCount={highRiskLoads.length}
        unresolvedAlertsCount={unresolvedAlerts.length}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top bar contract */}
        <TopBar
          currentSection={currentSection}
          activePeriod={activePeriod}
          onChangePeriod={setActivePeriod}
          onOpenSearch={() => setIsCommandOpen(true)}
          onRefreshData={handleManualRefresh}
          isRefreshing={isRefreshing}
          theme={theme}
          onToggleTheme={(e) => themeFromEvent(theme === "dark" ? "light" : "dark", e)}
          alerts={alerts}
          onOpenAlerts={() => setCurrentSection("alerts")}
          onOpenSettings={() => setIsSettingsOpen(true)}
          lastUpdatedSeconds={lastUpdatedSeconds}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          live={live}
          team={[teamUser]}
          onLogout={() => {
            clearSession();
            setSession(null);
          }}
          userName={session.user_name}
          userRole={session.role}
        />

        {/* Content Area */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection}
              initial={motionEnabled ? { opacity: 0, y: 8 } : undefined}
              animate={{ opacity: 1, y: 0 }}
              exit={motionEnabled ? { opacity: 0, y: -6 } : undefined}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <Suspense fallback={<SectionFallback />}>
              {bootError && (
                <div className="m-4 sm:m-6 mb-0 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-700 dark:text-sky-300">
                  {bootError}
                </div>
              )}
              {currentSection === "overview" && (
                <div className="p-4 sm:p-6 space-y-6">
                  {/* Executive KPI Grid */}
                  <KPICardGrid
                    metrics={metrics}
                    onFilterByStatus={handleFilterLoadsByStatus}
                    activePeriod={activePeriod}
                    trends={trends.map((t) => ({ period: t.day, loads: t.loads, revenue: t.revenue, delayed: t.delayed }))}
                  />

                  {/* Analytics & Operations Dashboard Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Primary Column: Load Volume Trajectory & Carrier Reliability Leaderboard */}
                    <div className="lg:col-span-8 flex flex-col gap-5">
                      <LoadTrendChart
                        points={trends}
                        demo={!live}
                        stats={{
                          inTransit: metrics.inTransitLoads ?? 0,
                          delayed: metrics.delayedLoads,
                          delayedRate:
                            metrics.totalLoads > 0 ? (metrics.delayedLoads / metrics.totalLoads) * 100 : 0,
                        }}
                      />
                      <CarrierLeaderboard
                        carriers={carriers}
                        onSelectCarrier={handleSelectCarrier}
                        demo={!live}
                      />
                    </div>

                    {/* Operations Column: Risk Attention Panel & Live Fleet Activity */}
                    <div className="lg:col-span-4 flex flex-col gap-5">
                      <RiskPanel
                        highRiskLoads={highRiskLoads}
                        delayedLoads={delayedLoads}
                        carriersUnderReview={carriersUnderReview}
                        onSelectLoad={(ld) => openLoad(ld)}
                        onSelectCarrier={handleSelectCarrier}
                        onAskAIAboutLoad={handleAskAIAboutLoad}
                      />

                      {/* Live Activity Feed */}
                      <div className="p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                              Live Fleet Events
                            </h3>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-400">
                            {live ? "Live feed" : "Demo snapshot"}
                          </span>
                        </div>

                        <ActivityFeed
                          events={activity}
                          onSelectEvent={(ev) => {
                            const m = ev.title.match(/L\d+/);
                            if (m) {
                              const found =
                                loads.find((l) => l.id === m[0]) || highRisk.find((l) => l.id === m[0]);
                              if (found) openLoad(found);
                            }
                          }}
                        />
                      </div>

                      {/* AI Copilot Quick Assist Banner */}
                      <div className="p-4 rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/50 to-indigo-50/20 dark:from-blue-950/20 dark:to-neutral-900/40 text-xs space-y-2">
                        <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                          <Sparkles className="w-4 h-4 text-blue-500" />
                          <span>Ask AI Logistics Copilot</span>
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                          Generate read-only SQL reports, query carrier SLA history, or retrieve breakdown SOPs in real time.
                        </p>
                        <div className="mt-2 pt-1">
                          <AnimatedLink
                            onClick={() => setCurrentSection("copilot")}
                            variant="magnetic-arrow"
                          >
                            Open Copilot Console
                          </AnimatedLink>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentSection === "loads" && (
                <LoadsView
                  onSelectLoad={(ld) => openLoad(ld)}
                  statusFilter={loadStatusFilter}
                  reloadKey={loadsReloadKey}
                  demo={!live}
                />
              )}

              {currentSection === "predictions" && (
                <PredictionsView
                  loads={highRiskLoads}
                  onSelectLoad={(ld) => openLoad(ld)}
                  onAskCopilot={handleTriggerCopilotQuery}
                  benchmark={benchmark}
                />
              )}

              {currentSection === "carriers" && (
                <div className="p-4 sm:p-6 space-y-6">
                  <CarrierLeaderboard
                    carriers={carriers}
                    onSelectCarrier={handleSelectCarrier}
                    demo={!live}
                  />
                </div>
              )}

              {currentSection === "copilot" && (
                <AICopilotView
                  initialQuery={copilotInitialQuery}
                  onSelectLoad={(ld) => openLoad(ld)}
                />
              )}

              {currentSection === "knowledge" && (
                <KnowledgeBaseView
                  documents={documents}
                  canUpload={canManage}
                  onUpload={handleUploadDoc}
                  onAskCopilot={handleTriggerCopilotQuery}
                />
              )}

              {currentSection === "alerts" && (
                <AlertsCenterView
                  alerts={alerts}
                  onResolveAlert={handleResolveAlert}
                  canTrigger={canManage}
                  onTrigger={handleTriggerWorkflow}
                  onSelectEntity={(entId, type) => {
                    if (type === "load") {
                      const numeric = Number(entId);
                      if (Number.isFinite(numeric)) openLoadByDbId(numeric);
                    } else if (type === "carrier") {
                      setCurrentSection("carriers");
                    }
                  }}
                />
              )}

              {currentSection === "analytics" && <AnalyticsView lanes={lanes} />}

              {currentSection === "settings" && (
                <div className="p-4 sm:p-6 max-w-2xl">
                  <div className="p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs space-y-4">
                    <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                      Settings & Configurations
                    </h3>
                    <p className="text-xs text-neutral-500">
                      Manage display preferences, motion animation kill-switch, and notification rules.
                    </p>
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-medium"
                    >
                      Open Preferences Panel
                    </button>
                  </div>
                </div>
              )}
              </Suspense>
            </motion.div>
          </AnimatePresence>

          {/* Global Platform Footer with Great UI Social Cards */}
          <footer className="mt-12 py-6 pr-6 border-t border-neutral-200/60 dark:border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-neutral-800 dark:text-neutral-200">Tracc</span>
              <span>·</span>
              <span>Autonomous Dispatch & Supply Chain Intelligence</span>
            </div>

            <div className="flex items-center gap-5 flex-wrap mr-3 shrink-0">
              <GithubCard
                username="YashGangal"
                name="Yash Gangal"
                href="https://github.com/YashGangal"
                text="Architected by Yash Gangal on"
                linkText="GitHub"
                themeScheme="green"
                isDark={theme === "dark"}
                className="text-xs"
                popoverClassName="w-80 text-left"
              />
              <LinkedinCard
                username="yash-gangal"
                name="Yash Gangal"
                href="https://www.linkedin.com/in/yash-gangal/"
                text="Connect on"
                linkText="LinkedIn"
                className="text-xs"
                linkClassName="text-[#0A66C2] dark:text-blue-400 font-semibold"
                popoverClassName="w-80 text-left"
              />
            </div>
          </footer>
        </main>
      </div>

      {/* Slide-out Load Detail Drawer */}
      <Suspense fallback={null}>
        <LoadDetailDrawer
          load={selectedLoad}
          onClose={() => setSelectedLoad(null)}
          onAskAI={handleAskAIAboutLoad}
        />
      </Suspense>

      {/* Global Command Palette (⌘K) */}
      <Suspense fallback={null}>
        <CommandPalette
          isOpen={isCommandOpen}
          onClose={() => setIsCommandOpen(false)}
          onOpen={() => setIsCommandOpen(true)}
          loads={loads}
          carriers={carriers}
          documents={documents}
          onSelectLoad={(ld) => openLoad(ld)}
          onSelectCarrier={handleSelectCarrier}
          onSelectDocument={() => setCurrentSection("knowledge")}
          onTriggerCopilotQuery={handleTriggerCopilotQuery}
        />
      </Suspense>

      {/* Settings Modal */}
      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          theme={theme}
          onToggleTheme={() => commitTheme(theme === "dark" ? "light" : "dark")}
          onSelectTheme={(t, e) => themeFromEvent(t, e)}
          motionEnabled={motionEnabled}
          onToggleMotion={() => setMotionEnabled(!motionEnabled)}
          refreshInterval={refreshInterval}
          onChangeRefreshInterval={setRefreshInterval}
          riskThreshold={riskThreshold}
          onChangeRiskThreshold={setRiskThreshold}
        />
      </Suspense>
    </div>
  );
}
