import React, { useState } from "react";
import { motion } from "motion/react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { cn } from "../../lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Truck,
} from "lucide-react";

interface DataPoint {
  day: string;
  delivered: number;
  inTransit: number;
  delayed: number;
  total: number;
}

export interface TrendInput {
  day: string;
  loads: number;
  delayed: number;
}

interface LoadTrendChartProps {
  /** Live daily points from /analytics/revenue-trends. Falls back to demo data when absent. */
  points?: TrendInput[];
  demo?: boolean;
  /** Live pipeline snapshot for the mini strip. */
  stats?: { inTransit: number; delayed: number; delayedRate: number };
}

const trendData: DataPoint[] = [
  { day: "Sep 1", delivered: 340, inTransit: 110, delayed: 14, total: 464 },
  { day: "Sep 5", delivered: 365, inTransit: 125, delayed: 18, total: 508 },
  { day: "Sep 9", delivered: 390, inTransit: 140, delayed: 22, total: 552 },
  { day: "Sep 13", delivered: 410, inTransit: 130, delayed: 19, total: 559 },
  { day: "Sep 17", delivered: 425, inTransit: 155, delayed: 25, total: 605 },
  { day: "Sep 21", delivered: 440, inTransit: 160, delayed: 21, total: 621 },
  { day: "Sep 25", delivered: 462, inTransit: 172, delayed: 18, total: 652 },
];

export const LoadTrendChart: React.FC<LoadTrendChartProps> = ({ points, demo = false, stats }) => {
  const [activeSeries, setActiveSeries] = useState<"all" | "delayed" | "delivered">("all");
  const live = points && points.length > 0;
  const data: DataPoint[] = live
    ? points!.map((p) => ({
        day: p.day,
        delivered: Math.max(0, p.loads - p.delayed),
        inTransit: 0,
        delayed: p.delayed,
        total: p.loads,
      }))
    : trendData;
  const hasTransit = data.some((d) => d.inTransit > 0);
  const last = data[data.length - 1];
  const miniDelivered = last.delivered;
  const miniTransit = stats?.inTransit ?? last.inTransit;
  const miniDelayed = stats?.delayed ?? last.delayed;
  const miniRate = stats?.delayedRate ?? (last.total > 0 ? (last.delayed / last.total) * 100 : 0);

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs flex flex-col justify-between transition-all">
      {/* Header & Controls */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Load Volume & Exception Trajectory
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
                Daily Rolling
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Real-time delivery throughput vs in-transit fleet & delivery exceptions
            </p>
          </div>
        </div>

        {/* Series Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/60">
          <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-lg text-xs font-medium self-start sm:self-auto border border-neutral-200/60 dark:border-neutral-700/60 relative">
            <button
              onClick={() => setActiveSeries("all")}
              className={cn(
                "relative px-2.5 py-1 rounded-md transition-colors z-10",
                activeSeries === "all"
                  ? "text-neutral-900 dark:text-neutral-100 font-semibold"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              )}
            >
              {activeSeries === "all" && (
                <motion.div
                  layoutId="activeSeriesPill"
                  className="absolute inset-0 bg-white dark:bg-neutral-700 rounded-md shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              All Trajectories
            </button>
            <button
              onClick={() => setActiveSeries("delayed")}
              className={cn(
                "relative px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 z-10",
                activeSeries === "delayed"
                  ? "text-red-600 dark:text-red-400 font-semibold"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              )}
            >
              {activeSeries === "delayed" && (
                <motion.div
                  layoutId="activeSeriesPill"
                  className="absolute inset-0 bg-white dark:bg-neutral-700 rounded-md shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Exceptions Only
            </button>
            <button
              onClick={() => setActiveSeries("delivered")}
              className={cn(
                "relative px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 z-10",
                activeSeries === "delivered"
                  ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              )}
            >
              {activeSeries === "delivered" && (
                <motion.div
                  layoutId="activeSeriesPill"
                  className="absolute inset-0 bg-white dark:bg-neutral-700 rounded-md shadow-xs -z-10"
                  transition={{ type: "spring", stiffness: 450, damping: 32 }}
                />
              )}
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              On-time flow
            </button>
          </div>

          <span className="text-[11px] font-mono text-neutral-400">
            {live ? (demo ? "Demo snapshot" : `Live · ${data[0]?.day} → ${last.day}`) : "Demo snapshot"}
          </span>
        </div>
      </div>

      {/* Mini metric highlight strip */}
      <div className="grid grid-cols-3 gap-2 py-2 px-3 mb-3 rounded-lg border text-xs font-mono bg-neutral-50/80 dark:bg-neutral-800/40 border-neutral-200/60 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-neutral-400 text-[10px] block truncate">Non-delayed flow</span>
            <div className="flex items-center gap-1 font-bold text-neutral-900 dark:text-neutral-100">
              <span>{miniDelivered.toLocaleString()}</span>
              <span className="text-[10px] font-normal text-neutral-400 font-sans">loads</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-neutral-200 dark:border-neutral-800 pl-3">
          <Truck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-neutral-400 text-[10px] block truncate">Active In Transit</span>
            <div className="flex items-center gap-1 font-bold text-neutral-900 dark:text-neutral-100">
              <span>{miniTransit.toLocaleString()}</span>
              <span className="text-[10px] font-normal text-neutral-400 font-sans">loads</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-neutral-200 dark:border-neutral-800 pl-3">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-neutral-400 text-[10px] block truncate">Exceptions</span>
            <span className="font-bold text-red-600 dark:text-red-400">{miniDelayed.toLocaleString()} ({miniRate.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Area Chart Canvas */}
      <div className="w-full h-64 min-w-0 relative">
        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={240}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 14, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="deliveredGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="transitGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="delayedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="currentColor"
              className="text-neutral-200/70 dark:text-neutral-800/80"
            />

            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#a1a1aa", fontFamily: "var(--font-mono)" }}
              dy={4}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#a1a1aa", fontFamily: "var(--font-mono)" }}
              dx={-4}
              domain={[0, "dataMax + 10"]}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 rounded-lg p-2.5 shadow-xl text-xs font-mono space-y-1.5 min-w-[170px]">
                    <div className="font-semibold text-neutral-900 dark:text-neutral-100 border-b border-neutral-200 dark:border-neutral-800 pb-1">
                      {label}, 2026
                    </div>
                    {payload.map((entry: any) => (
                      <div
                        key={entry.dataKey}
                        className="flex items-center justify-between gap-4 text-[11px]"
                      >
                        <span className="flex items-center gap-1.5 text-neutral-500">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{entry.name}:</span>
                        </span>
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">
                          {entry.value} loads
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />

            {(activeSeries === "all" || activeSeries === "delivered") && (
              <Area
                type="monotone"
                dataKey="delivered"
                name="Non-delayed"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#deliveredGrad)"
                activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            )}

            {activeSeries === "all" && hasTransit && (
              <Area
                type="monotone"
                dataKey="inTransit"
                name="In Transit"
                stroke="#3b82f6"
                strokeWidth={1.75}
                fill="url(#transitGrad)"
                activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            )}

            {(activeSeries === "all" || activeSeries === "delayed") && (
              <Area
                type="monotone"
                dataKey="delayed"
                name="Delayed"
                stroke="#f87171"
                strokeWidth={2}
                fill="url(#delayedGrad)"
                activeDot={{ r: 4, stroke: "#ffffff", strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Non-delayed flow</span>
          </div>
          {hasTransit && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span>Active In Transit</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span>Exceptions (Delayed)</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400">
          <span>Automated TMS Telemetry</span>
        </div>
      </div>
    </div>
  );
};
