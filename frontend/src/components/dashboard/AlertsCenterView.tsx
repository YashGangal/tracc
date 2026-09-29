import React, { useState } from "react";
import { Bell, AlertTriangle, AlertCircle, CheckCircle2, Play, Cpu, ShieldAlert, Check } from "lucide-react";
import { AlertItem, LoadItem } from "../../lib/types";
import { cn } from "../../lib/utils";

const WORKFLOWS = [
  { id: "workflow_a" as const, label: "Workflow A: Delayed Load Alert", desc: "Scans delayed loads every 15m; opens incidents." },
  { id: "workflow_b" as const, label: "Workflow B: Daily Ops Report", desc: "Weekday 07:00 ET executive KPI brief (idempotent)." },
  { id: "workflow_c" as const, label: "Workflow C: Carrier SLA Breach", desc: "Flags carriers breaching the 15% 14-day late-rate threshold." },
];

interface AlertsCenterViewProps {
  alerts: AlertItem[];
  onResolveAlert: (id: string) => void;
  onSelectEntity: (entityId: string, entityType: string) => void;
  canTrigger: boolean;
  onTrigger: (workflow: "workflow_a" | "workflow_b" | "workflow_c") => Promise<string>;
}

export const AlertsCenterView: React.FC<AlertsCenterViewProps> = ({
  alerts,
  onResolveAlert,
  onSelectEntity,
  canTrigger,
  onTrigger,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<"all" | "critical" | "warning" | "resolved">("all");
  const [runningWorkflow, setRunningWorkflow] = useState<string | null>(null);
  const [workflowSuccessMsg, setWorkflowSuccessMsg] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  const filtered = alerts.filter((a) => {
    if (filterSeverity === "critical") return a.severity === "critical" && !a.resolved;
    if (filterSeverity === "warning") return a.severity === "warning" && !a.resolved;
    if (filterSeverity === "resolved") return a.resolved;
    return true;
  });

  const handleTriggerWorkflow = async (workflowId: "workflow_a" | "workflow_b" | "workflow_c", label: string) => {
    setRunningWorkflow(workflowId);
    setWorkflowSuccessMsg(null);
    setWorkflowError(null);
    try {
      const msg = await onTrigger(workflowId);
      setWorkflowSuccessMsg(`✓ ${label}: ${msg}`);
    } catch (e: any) {
      setWorkflowError(e?.message || "Workflow trigger failed");
    } finally {
      setRunningWorkflow(null);
      setTimeout(() => {
        setWorkflowSuccessMsg(null);
        setWorkflowError(null);
      }, 6000);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Bell className="w-5 h-5 text-red-500" />
            <span>Alerts & Workflow Automation Center</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Automated exception tracking with integrated n8n scheduled triggers and threshold alerts.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg text-xs font-medium self-start sm:self-auto border border-neutral-200 dark:border-neutral-800">
          {(["all", "critical", "warning", "resolved"] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={cn(
                "px-3 py-1 rounded-md transition-colors capitalize",
                filterSeverity === sev
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              )}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {workflowSuccessMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{workflowSuccessMsg}</span>
        </div>
      )}

      {workflowError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{workflowError}</span>
        </div>
      )}

      {/* n8n Automation Workflows Bar */}
      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              n8n Workflow Automation Pipelines
            </h3>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
            {canTrigger ? "3 Workflows Active" : "Read-only role"}
          </span>
        </div>

        {!canTrigger ? (
          <p className="text-xs text-neutral-500">
            Your role can resolve incidents but cannot trigger workflows. Log in as an operations manager or admin for trigger rights.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {WORKFLOWS.map((w) => (
              <div key={w.id} className="p-3 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col justify-between">
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">{w.label}</div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">{w.desc}</p>
                </div>
                <button
                  onClick={() => handleTriggerWorkflow(w.id, w.label)}
                  disabled={runningWorkflow !== null}
                  className="mt-3 px-2.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[11px] font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  <Play className="w-3 h-3" />
                  <span>{runningWorkflow === w.id ? "Executing..." : "Run Now"}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {filtered.map((alt) => (
          <div
            key={alt.id}
            className={cn(
              "p-4 rounded-xl border bg-white dark:bg-neutral-900/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs transition-all",
              alt.resolved
                ? "opacity-60 border-neutral-200 dark:border-neutral-800"
                : alt.severity === "critical"
                ? "border-red-200 dark:border-red-950/60"
                : "border-amber-200 dark:border-amber-950/60"
            )}
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border",
                    alt.severity === "critical"
                      ? "border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/10"
                      : alt.severity === "warning"
                      ? "border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      : "border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                  )}
                >
                  {alt.type}
                </span>
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {alt.title}
                </span>
                <span className="text-[11px] font-mono text-neutral-400">
                  · {alt.timestamp}
                </span>
              </div>

              <p className="text-neutral-600 dark:text-neutral-300">
                {alt.reason}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {alt.entityId && (
                <button
                  onClick={() => onSelectEntity(alt.entityId, alt.entityType)}
                  className="px-2.5 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {alt.actionLabel || "Inspect"}
                </button>
              )}

              {!alt.resolved ? (
                <button
                  onClick={() => onResolveAlert(alt.id)}
                  className="px-2.5 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 flex items-center gap-1 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  <span>Resolve</span>
                </button>
              ) : (
                <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
