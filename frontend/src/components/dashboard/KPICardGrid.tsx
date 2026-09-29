import React from "react";
import { motion } from "motion/react";
import { MetricData } from "../../lib/types";
import { AnimatedNumber } from "../codedvisuals/AnimatedNumber";
import { RechartsSparkline, SparklinePoint } from "../codedvisuals/RechartsSparkline";
import { SpotlightCard } from "../codedvisuals/SpotlightCard";
import { formatCurrency, formatPercent, cn } from "../../lib/utils";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface KPICardGridProps {
  metrics: MetricData;
  onFilterByStatus?: (status: string) => void;
  activePeriod?: string;
  /** Live 14-day history from /analytics/revenue-trends (chronological).
   *  Every card below derives a real series from it — no static claims. */
  trends?: { period: string; loads: number; revenue: number; delayed: number }[];
}

interface KPICardConfig {
  id: string;
  eyebrow: string;
  value: number;
  formatter: (v: number) => string;
  delta: string;
  trend: "up" | "down" | "neutral";
  chartColor: string;
  periodLabel: string;
  rangeSummary: string;
  badge?: string;
  badgeColor?: string;
  action?: () => void;
  historyData: SparklinePoint[];
}

export const KPICardGrid: React.FC<KPICardGridProps> = ({
  metrics,
  onFilterByStatus,
  activePeriod = "Month to Date (Sep 1–25)",
  trends = [],
}) => {
  const pct = (first: number, last: number) =>
    first > 0 ? `${(((last - first) / first) * 100).toFixed(1)}%` : "—";
  const pp = (first: number, last: number) =>
    `${(last - first >= 0 ? "+" : "")}${(last - first).toFixed(1)}pp`;
  const compactRange = (vals: number[], fmt: (v: number) => string) =>
    vals.length > 1 ? `${fmt(vals[0])} → ${fmt(vals[vals.length - 1])}` : "live snapshot";

  // Real per-day series from the 14-day window. Cumulative cards anchor to
  // the live totals (total - future daily increments); rate cards are pure
  // daily values. Carriers/drivers have no history endpoint — snapshot only.
  const days = trends;
  const cumFromDaily = (pick: (t: (typeof days)[number]) => number, anchor: number) => {
    const out: number[] = new Array(days.length);
    let acc = anchor;
    for (let i = days.length - 1; i >= 0; i--) {
      out[i] = acc;
      acc -= pick(days[i]);
    }
    return out;
  };
  const cumLoads = days.length > 1 ? cumFromDaily((t) => t.loads, metrics.totalLoads) : [];
  const cumRev = days.length > 1 ? cumFromDaily((t) => t.revenue, metrics.revenue) : [];
  const otdDaily =
    days.length > 1
      ? days.map((t) => (t.loads > 0 ? ((t.loads - t.delayed) / t.loads) * 100 : 100))
      : [];
  const delayedDaily = days.length > 1 ? days.map((t) => t.delayed) : [];
  const deliveredDaily = days.length > 1 ? days.map((t) => Math.max(0, t.loads - t.delayed)) : [];
  const avgRevDaily =
    days.length > 1 ? days.map((t) => (t.loads > 0 ? t.revenue / t.loads : 0)) : [];
  const hist = (vals: number[]) =>
    vals.map((value, i) => ({ period: days[i]?.period ?? "", value }));
  const cards: KPICardConfig[] = [
    {
      id: "total-loads",
      eyebrow: "Total Dispatched Loads",
      value: metrics.totalLoads,
      formatter: (v: number) => v.toLocaleString(),
      delta: cumLoads.length > 1 ? `+${(cumLoads[cumLoads.length - 1] - cumLoads[0]).toLocaleString()} / 14d` : "live",
      trend: "neutral",
      chartColor: "#3b82f6",
      periodLabel: "trailing 14 days",
      rangeSummary: compactRange(cumLoads, (v) => `${(v / 1000).toFixed(1)}K`),
      historyData: hist(cumLoads),
      action: () => onFilterByStatus?.("all"),
    },
    {
      id: "revenue",
      eyebrow: "Operational Revenue",
      value: metrics.revenue,
      formatter: (v: number) => formatCurrency(v),
      delta: cumRev.length > 1 ? `+${formatCurrency(cumRev[cumRev.length - 1] - cumRev[0])} / 14d` : "live",
      trend: "neutral",
      chartColor: "#10b981",
      periodLabel: "trailing 14 days",
      rangeSummary: compactRange(cumRev, (v) => `$${(v / 1000).toFixed(0)}K`),
      historyData: hist(cumRev),
    },
    {
      id: "ontime",
      eyebrow: "On-Time Delivery Rate",
      value: metrics.onTimeDeliveryRate,
      formatter: (v: number) => formatPercent(v),
      delta: otdDaily.length > 1 ? pp(otdDaily[0], otdDaily[otdDaily.length - 1]) : "live",
      trend: "neutral",
      chartColor: "#10b981",
      periodLabel: "delivered ÷ (delivered + delayed)",
      rangeSummary: compactRange(otdDaily, (v) => `${v.toFixed(1)}%`),
      historyData: hist(otdDaily),
    },
    {
      id: "delayed",
      eyebrow: "Delayed Loads (Attention)",
      value: metrics.delayedLoads,
      formatter: (v: number) => v.toLocaleString(),
      delta: delayedDaily.length > 1 ? pct(delayedDaily[0], delayedDaily[delayedDaily.length - 1]) : "live",
      trend: "neutral",
      chartColor: "#f59e0b",
      periodLabel: `${metrics.totalLoads > 0 ? ((metrics.delayedLoads / metrics.totalLoads) * 100).toFixed(1) : "0.0"}% network share`,
      rangeSummary: "delayed pickups per day",
      badge: "Action Required",
      badgeColor: "text-amber-600 bg-amber-500/10 border-amber-500/20",
      historyData: hist(delayedDaily),
      action: () => onFilterByStatus?.("Delayed"),
    },
    {
      id: "avg-rev",
      eyebrow: "Avg Revenue / Load",
      value: metrics.avgRevenuePerLoad,
      formatter: (v: number) => `$${v.toFixed(2)}`,
      delta: avgRevDaily.length > 1 ? pct(avgRevDaily[0], avgRevDaily[avgRevDaily.length - 1]) : "live",
      trend: "neutral",
      chartColor: "#3b82f6",
      periodLabel: "trailing period",
      rangeSummary: "revenue per load per day",
      historyData: hist(avgRevDaily),
    },
    {
      id: "delivered",
      eyebrow: "Delivered Loads",
      value: metrics.deliveredLoads,
      formatter: (v: number) => v.toLocaleString(),
      delta: deliveredDaily.length > 1 ? pct(deliveredDaily[0], deliveredDaily[deliveredDaily.length - 1]) : "live",
      trend: "neutral",
      chartColor: "#10b981",
      periodLabel: "completed dispatches",
      rangeSummary: "non-delayed loads per day",
      historyData: hist(deliveredDaily),
      action: () => onFilterByStatus?.("Delivered"),
    },
    {
      id: "carriers",
      eyebrow: "Active Carriers",
      value: metrics.activeCarriers,
      formatter: (v: number) => v.toLocaleString(),
      delta: "live",
      trend: "neutral",
      chartColor: "#8b5cf6",
      periodLabel: "compliance verified",
      rangeSummary: "live snapshot",
      historyData: [],
    },
    {
      id: "drivers",
      eyebrow: "Active Drivers Assigned",
      value: metrics.activeDrivers,
      formatter: (v: number) => v.toLocaleString(),
      delta: "live",
      trend: "neutral",
      chartColor: "#06b6d4",
      periodLabel: "ELD synchronized",
      rangeSummary: "live snapshot",
      historyData: [],
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((card, idx) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: idx * 0.03, ease: [0.22, 1, 0.36, 1] }}
          className="h-full"
        >
          <SpotlightCard
            onClick={card.action}
            spotlightColor={
              card.id === "delayed"
                ? "rgba(239, 68, 68, 0.15)"
                : card.id === "delivered"
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(59, 130, 246, 0.15)"
            }
            borderColor={
              card.id === "delayed"
                ? "rgba(239, 68, 68, 0.4)"
                : card.id === "delivered"
                ? "rgba(16, 185, 129, 0.4)"
                : "rgba(59, 130, 246, 0.4)"
            }
            className={cn(
              "p-4 h-full flex flex-col justify-between group min-w-0 transition-all",
              card.action && "cursor-pointer"
            )}
          >
            <div>
              {/* Eyebrow & optional badge */}
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate">
                  {card.eyebrow}
                </span>
                {card.badge && (
                  <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", card.badgeColor)}>
                    {card.badge}
                  </span>
                )}
              </div>

              {/* Metric value and trend delta */}
              <div className="flex items-baseline justify-between gap-2 mt-1">
                <div className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                  <AnimatedNumber value={card.value} formatter={card.formatter} />
                </div>
                <span
                  className={cn(
                    "inline-flex items-center font-mono font-medium text-xs",
                    card.id === "delayed"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {card.trend === "up" ? (
                    <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                  ) : card.trend === "down" ? (
                    <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                  ) : null}
                  {card.delta}
                </span>
              </div>
            </div>

            {/* Recharts Micro-Sparkline Chart */}
            <div className="my-2 pt-1 min-h-[36px]">
              {card.historyData.length > 1 ? (
                <RechartsSparkline
                  data={card.historyData}
                  gradientId={`kpi-grad-${card.id}`}
                  color={card.chartColor}
                  formatter={card.formatter}
                  height={36}
                  trend={card.trend}
                />
              ) : (
                <p className="text-[11px] font-mono text-neutral-400">live snapshot · trend builds over time</p>
              )}
            </div>

            {/* Card Footer: Period Label & Progression indicator */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 font-mono">
              <span className="truncate">{card.periodLabel}</span>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 font-medium">
                {card.rangeSummary}
              </span>
            </div>
          </SpotlightCard>
        </motion.div>
      ))}
    </div>
  );
};
