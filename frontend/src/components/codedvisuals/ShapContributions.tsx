import React from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

interface ShapFactor {
  factor: string;
  impact: number; // positive = pushes toward late, negative = mitigates/on-time
  description?: string;
}

interface ShapContributionsProps {
  factors: ShapFactor[];
  className?: string;
  animated?: boolean;
}

export const ShapContributions: React.FC<ShapContributionsProps> = ({
  factors,
  className,
  animated = true,
}) => {
  const maxAbsImpact = Math.max(...factors.map((f) => Math.abs(f.impact)), 0.5);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
        <span>Contributing Factor (SHAP Value)</span>
        <span className="font-mono">Impact on Delay</span>
      </div>

      <div className="space-y-2">
        {factors.map((item, index) => {
          const isDelay = item.impact > 0;
          const widthPercent = (Math.abs(item.impact) / maxAbsImpact) * 100;

          return (
            <div key={item.factor} className="group text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  <span className="text-neutral-400 dark:text-neutral-500 mr-1.5 font-mono">
                    {index + 1}.
                  </span>
                  {item.factor}
                </span>
                <span
                  className={cn(
                    "font-mono font-medium",
                    isDelay
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {isDelay ? `+${item.impact.toFixed(2)}` : item.impact.toFixed(2)}
                </span>
              </div>

              {/* Dual Directional Bar */}
              <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden flex">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    isDelay ? "bg-red-500/80 dark:bg-red-400" : "bg-emerald-500/80 dark:bg-emerald-400"
                  )}
                  initial={animated ? { width: 0 } : { width: `${widthPercent}%` }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{
                    duration: 0.45,
                    delay: animated ? index * 0.08 : 0,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>

              {item.description && (
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 pl-4 leading-relaxed">
                  {item.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
