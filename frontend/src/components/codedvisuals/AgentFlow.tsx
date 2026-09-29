import React from "react";
import { motion } from "motion/react";
import { Check, Loader2, AlertCircle, Database, ShieldCheck, Terminal, Cpu, FileText } from "lucide-react";
import { cn } from "../../lib/utils";

export type AgentStepStatus = "idle" | "running" | "complete" | "error";

export interface AgentStep {
  id: string;
  name: string;
  description: string;
  status: AgentStepStatus;
  detail?: string;
}

interface AgentFlowProps {
  steps: AgentStep[];
  currentQuery?: string;
  sqlQuery?: string;
  className?: string;
  animated?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  intent: <Cpu className="w-3.5 h-3.5" />,
  sql: <Terminal className="w-3.5 h-3.5" />,
  validate: <ShieldCheck className="w-3.5 h-3.5" />,
  database: <Database className="w-3.5 h-3.5" />,
  analysis: <FileText className="w-3.5 h-3.5" />,
};

export const AgentFlow: React.FC<AgentFlowProps> = ({
  steps,
  sqlQuery,
  className,
}) => {
  return (
    <div className={cn("space-y-4 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 bg-white dark:bg-neutral-900/40", className)}>
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
            AI Operations Pipeline
          </h4>
        </div>
        <span className="text-[11px] font-mono text-neutral-400">Read-Only Enforced</span>
      </div>

      <div className="space-y-2.5">
        {steps.map((step, idx) => {
          const isCurrent = step.status === "running";
          const isDone = step.status === "complete";
          const isError = step.status === "error";

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 p-2.5 rounded-md transition-all text-xs border",
                isCurrent
                  ? "bg-blue-500/5 border-blue-500/30 dark:bg-blue-500/10 text-neutral-900 dark:text-neutral-100"
                  : isDone
                  ? "bg-neutral-50/50 dark:bg-neutral-900/20 border-transparent text-neutral-700 dark:text-neutral-300"
                  : isError
                  ? "bg-red-500/5 border-red-500/30 text-red-600 dark:text-red-400"
                  : "border-transparent text-neutral-400 dark:text-neutral-600 opacity-60"
              )}
            >
              {/* Step Icon / Status Badge */}
              <div
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center shrink-0 border mt-0.5",
                  isDone
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                    : isCurrent
                    ? "bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-400"
                    : isError
                    ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                    : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400"
                )}
              >
                {isDone ? (
                  <Check className="w-3.5 h-3.5" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isError ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : (
                  iconMap[step.id] || <span className="font-mono text-[10px]">{idx + 1}</span>
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-900 dark:text-neutral-200">
                    {step.name}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400 capitalize">
                    {step.status}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {step.description}
                </p>

                {/* Sub details if available */}
                {step.detail && isDone && (
                  <div className="mt-1.5 p-1.5 rounded bg-neutral-100 dark:bg-neutral-800/80 font-mono text-[10px] text-neutral-600 dark:text-neutral-300">
                    {step.detail}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {sqlQuery && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800"
        >
          <div className="flex items-center justify-between text-[11px] text-neutral-500 mb-1.5">
            <span className="font-mono flex items-center gap-1.5">
              <Terminal className="w-3 h-3 text-blue-500" /> Generated Read-Only Query
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">✓ AST Validation Passed</span>
          </div>
          <pre className="p-2.5 rounded bg-neutral-950 text-neutral-100 text-[11px] font-mono overflow-x-auto border border-neutral-800 leading-relaxed">
            {sqlQuery}
          </pre>
        </motion.div>
      )}
    </div>
  );
};
