import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  Clock,
  Terminal,
  ChevronDown,
  RefreshCw,
  Play,
  Layers,
} from "lucide-react";
import { cn } from "../../lib/utils";

export interface PipelineStep {
  id: string;
  name: string;
  category: string;
  status: "completed" | "running" | "pending" | "failed";
  durationMs?: number;
  logs: string[];
}

const defaultSteps: PipelineStep[] = [
  {
    id: "telemetry",
    name: "IoT GPS Telemetry Ingestion",
    category: "Ingestion",
    status: "completed",
    durationMs: 42,
    logs: [
      "[00:01:04] Ingesting MQTT stream from 1,640 active ELD transponders...",
      "[00:01:04] 100% geofence boundaries validated against shipper terminals.",
      "[00:01:04] Packet loss: 0.00% across I-80 & I-95 logistics corridors.",
    ],
  },
  {
    id: "shap",
    name: "SHAP XGBoost Delay Inference",
    category: "Predictive ML",
    status: "completed",
    durationMs: 118,
    logs: [
      "[00:01:05] Running XGBoost ensemble v4.2 with Shapley feature weights...",
      "[00:01:05] Evaluated 18 high-risk load vectors against real-time NOAA radar.",
      "[00:01:05] Identified +4.2h storm delay risk for Load L10092.",
    ],
  },
  {
    id: "compliance",
    name: "FMCSA Carrier Safety & HOS Audit",
    category: "Compliance",
    status: "completed",
    durationMs: 65,
    logs: [
      "[00:01:05] Querying DOT SAFER database for MC-892101 & MC-440192...",
      "[00:01:05] Verified 11-hour driver rest compliance; 0 OOS orders recorded.",
      "[00:01:05] Carrier safety score certified above 85th percentile.",
    ],
  },
  {
    id: "routing",
    name: "Dynamic Reroute & ETA Re-solver",
    category: "Routing",
    status: "completed",
    durationMs: 94,
    logs: [
      "[00:01:06] Simulated 3 alternate transit corridors avoiding I-80 closure.",
      "[00:01:06] Selected US-30 bypass: saved 1.8h projected detention.",
      "[00:01:06] Automated dispatch waypoint pushed to driver Samsara app.",
    ],
  },
  {
    id: "webhook",
    name: "Autonomous SLA Alert Broadcast",
    category: "Notification",
    status: "completed",
    durationMs: 31,
    logs: [
      "[00:01:06] Formatted JSON payload for EDI 214 Shipment Status Message.",
      "[00:01:06] Triggered high-priority webhook to Enterprise Shipper Portal.",
      "[00:01:06] All 5 protocol checkpoints signed and verified.",
    ],
  },
];

interface PipelineChecklistProps {
  className?: string;
}

/**
 * PipelineChecklist inspired by Great UI's Deployment Checklist / Terminal Loader
 * Interactive CI/CD and operational protocol checklist with animated steps,
 * live timing stats, and terminal execution logs.
 */
export const PipelineChecklist: React.FC<PipelineChecklistProps> = ({ className }) => {
  const [steps, setSteps] = useState<PipelineStep[]>(defaultSteps);
  const [isRunning, setIsRunning] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(-1);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const runPipelineSimulation = () => {
    if (isRunning) return;
    setIsRunning(true);
    setActiveStepIndex(0);

    // Reset all steps to pending
    setSteps((prev) =>
      prev.map((step, idx) => ({
        ...step,
        status: idx === 0 ? "running" : "pending",
      }))
    );

    let current = 0;
    const interval = setInterval(() => {
      setSteps((prev) =>
        prev.map((s, idx) => {
          if (idx < current) return { ...s, status: "completed" };
          if (idx === current) return { ...s, status: "completed" };
          if (idx === current + 1) return { ...s, status: "running" };
          return { ...s, status: "pending" };
        })
      );

      current++;
      setActiveStepIndex(current);

      if (current >= defaultSteps.length) {
        clearInterval(interval);
        setIsRunning(false);
        setActiveStepIndex(-1);
      }
    }, 600);
  };

  const toggleExpand = (id: string) => {
    setExpandedStepId(expandedStepId === id ? null : id);
  };

  return (
    <div
      className={cn(
        "p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs",
        className
      )}
    >
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200/80 dark:border-neutral-800 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
              Autonomous Pipeline Protocol
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
              TMS Orchestrator
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Automated sensor stream verification, ML risk calculation, and SLA dispatch
          </p>
        </div>

        <button
          onClick={runPipelineSimulation}
          disabled={isRunning}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-xs self-start sm:self-auto",
            isRunning
              ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white active:scale-95"
          )}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Executing Stage...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Pipeline Diagnostic</span>
            </>
          )}
        </button>
      </div>

      {/* Progress Bar & Health status */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs font-mono text-neutral-500 dark:text-neutral-400 mb-1.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Pipeline Integrity: 100% Validated</span>
          </span>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {completedCount} of {steps.length} stages passed
          </span>
        </div>
        <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </div>
      </div>

      {/* Checklist Stage Rows */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const isExpanded = expandedStepId === step.id;

          return (
            <div
              key={step.id}
              className={cn(
                "rounded-lg border transition-all overflow-hidden",
                step.status === "running"
                  ? "border-blue-400/80 dark:border-blue-500/80 bg-blue-50/40 dark:bg-blue-950/20"
                  : step.status === "completed"
                  ? "border-neutral-200/60 dark:border-neutral-800/80 bg-neutral-50/40 dark:bg-neutral-900/40"
                  : "border-neutral-200/40 dark:border-neutral-800/40 bg-transparent opacity-60"
              )}
            >
              {/* Row Header */}
              <div
                onClick={() => toggleExpand(step.id)}
                className="p-3 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Status Indicator Icon */}
                  {step.status === "completed" && (
                    <motion.div
                      initial={{ scale: 0.5, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    </motion.div>
                  )}
                  {step.status === "running" && (
                    <RefreshCw className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                  )}
                  {step.status === "pending" && (
                    <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                        {step.name}
                      </span>
                      <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                        {step.category}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {step.durationMs && (
                    <span className="font-mono text-[11px] text-neutral-400">
                      {step.durationMs}ms
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-neutral-400 transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}
                  />
                </div>
              </div>

              {/* Terminal Logs Drawer */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-neutral-200/60 dark:border-neutral-800 bg-neutral-950 p-3 text-[11px] font-mono text-emerald-400 space-y-1 overflow-hidden"
                  >
                    <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] pb-1 border-b border-neutral-800 mb-1">
                      <Terminal className="w-3 h-3" />
                      <span>Diagnostics STDOUT Output</span>
                    </div>
                    {step.logs.map((log, lIdx) => (
                      <div key={lIdx} className="leading-relaxed">
                        {log}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};
