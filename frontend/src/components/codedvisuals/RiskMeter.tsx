import React from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

interface RiskMeterProps {
  probability: number; // 0.0 to 1.0
  riskLevel?: "Low" | "Medium" | "High" | "Critical";
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
  animated?: boolean;
}

export const RiskMeter: React.FC<RiskMeterProps> = ({
  probability,
  riskLevel,
  showLabel = true,
  compact = false,
  className,
  animated = true,
}) => {
  const percent = Math.min(Math.max(Math.round(probability * 100), 0), 100);

  // Auto-classify if not provided
  const level =
    riskLevel ||
    (percent >= 80
      ? "Critical"
      : percent >= 60
      ? "High"
      : percent >= 35
      ? "Medium"
      : "Low");

  const colorConfig = {
    Low: {
      text: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-500",
      trackBg: "bg-emerald-500/20",
      badge: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
    },
    Medium: {
      text: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500",
      trackBg: "bg-amber-500/20",
      badge: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
    },
    High: {
      text: "text-orange-500 dark:text-orange-400",
      bg: "bg-orange-500",
      trackBg: "bg-orange-500/20",
      badge: "border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/10",
    },
    Critical: {
      text: "text-red-500 dark:text-red-400",
      bg: "bg-red-500",
      trackBg: "bg-red-500/20",
      badge: "border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10",
    },
  }[level];

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative w-20 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full", colorConfig.bg)}
            initial={animated ? { width: 0 } : { width: `${percent}%` }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <span className={cn("text-xs font-mono font-medium", colorConfig.text)}>
          {percent}%
        </span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-500 dark:text-neutral-400 font-medium">
          Late Probability
        </span>
        <div className="flex items-center gap-2">
          <span className={cn("font-mono font-semibold text-sm", colorConfig.text)}>
            {percent}%
          </span>
          {showLabel && (
            <span
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded border",
                colorConfig.badge
              )}
            >
              {level} Risk
            </span>
          )}
        </div>
      </div>

      {/* Meter track */}
      <div className="relative pt-1 pb-1">
        <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
          <motion.div
            className={cn("h-full rounded-full transition-all", colorConfig.bg)}
            initial={animated ? { width: 0 } : { width: `${percent}%` }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        {/* Ticks & scale */}
        <div className="flex justify-between text-[10px] text-neutral-400 dark:text-neutral-500 font-mono mt-1 px-0.5">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};
