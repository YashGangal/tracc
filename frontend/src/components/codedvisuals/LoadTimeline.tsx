import React from "react";
import { Check, Clock, AlertTriangle, Circle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TimelineMilestone {
  stage: string;
  time: string;
  completed: boolean;
  statusNote?: string;
}

interface LoadTimelineProps {
  milestones: TimelineMilestone[];
  className?: string;
}

export const LoadTimeline: React.FC<LoadTimelineProps> = ({
  milestones,
  className,
}) => {
  return (
    <div className={cn("space-y-4 relative text-xs", className)}>
      <div className="absolute left-2.5 top-3 bottom-3 w-px bg-neutral-200 dark:bg-neutral-800" />

      {milestones.map((item, idx) => {
        const isCurrent =
          item.completed && (idx === milestones.length - 1 || !milestones[idx + 1]?.completed);
        const isPending = !item.completed;
        const hasWarning = item.statusNote?.toLowerCase().includes("delay");

        return (
          <div key={item.stage} className="relative flex items-start gap-3 pl-0 group">
            {/* Node marker */}
            <div
              className={cn(
                "relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-colors",
                hasWarning
                  ? "bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400"
                  : item.completed
                  ? "bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                  : "bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700 text-neutral-400"
              )}
            >
              {hasWarning ? (
                <AlertTriangle className="w-2.5 h-2.5" />
              ) : item.completed ? (
                <Check className="w-2.5 h-2.5" />
              ) : isCurrent ? (
                <Clock className="w-2.5 h-2.5 text-blue-500" />
              ) : (
                <Circle className="w-1.5 h-1.5 fill-current opacity-40" />
              )}
            </div>

            {/* Stage content */}
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-medium",
                    item.completed
                      ? "text-neutral-900 dark:text-neutral-200"
                      : "text-neutral-500 dark:text-neutral-400"
                  )}
                >
                  {item.stage}
                </span>
                <span className="text-[11px] font-mono text-neutral-400">
                  {item.time}
                </span>
              </div>

              {item.statusNote && (
                <div
                  className={cn(
                    "mt-1 text-[11px] font-mono px-2 py-0.5 rounded inline-block",
                    hasWarning
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                  )}
                >
                  {item.statusNote}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
