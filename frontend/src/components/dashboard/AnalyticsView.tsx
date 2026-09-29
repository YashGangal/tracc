import React from "react";
import { BarChart3, Download, MapPin } from "lucide-react";
import { formatPercent } from "../../lib/utils";
import { PipelineChecklist } from "../codedvisuals/PipelineChecklist";
import { SpotlightCard } from "../codedvisuals/SpotlightCard";
import type { LaneRow } from "../../lib/backend";

export const AnalyticsView: React.FC<{ lanes?: LaneRow[] }> = ({ lanes = [] }) => {
  const rows = lanes;
  const byVolume = [...rows].sort((a, b) => b.volume - a.volume);
  const byReliability = [...rows].sort((a, b) => a.delay_rate - b.delay_rate);
  const byDelay = [...rows].sort((a, b) => b.delay_rate - a.delay_rate);
  const topVolume = byVolume[0];
  const topReliable = byReliability[0];
  const topDelayed = byDelay[0];
  const laneLabel = (l: LaneRow) => l.lane.replace(" -> ", " → ");

  function downloadCsv() {
    const header = "lane,volume,avg_miles,delay_rate_pct";
    const body = rows.map((r) => `"${r.lane}",${r.volume},${r.avg_miles},${r.delay_rate}`).join("\n");
    const blob = new Blob([[header, body].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lane_delay_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <span>Power BI Logistics Intelligence & Lane Profitability</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Aggregated lane volumes, corridor margin analyses, and carrier SLA compliance distributions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
            Live API · lane trends
          </div>
          <button
            onClick={downloadCsv}
            disabled={rows.length === 0}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Top lane cards (live) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SpotlightCard className="p-4">
          <span className="text-xs font-medium text-neutral-500">Top Volume Corridor</span>
          <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
            {topVolume ? laneLabel(topVolume) : "—"}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {topVolume ? `${topVolume.volume.toLocaleString()} loads · ${topVolume.avg_miles} mi avg` : "No lane data"}
          </p>
        </SpotlightCard>

        <SpotlightCard className="p-4" spotlightColor="rgba(16, 185, 129, 0.15)" borderColor="rgba(16, 185, 129, 0.4)">
          <span className="text-xs font-medium text-neutral-500">Highest Reliability Corridor</span>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {topReliable ? `${laneLabel(topReliable)} (${(100 - topReliable.delay_rate).toFixed(1)}%)` : "—"}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Lowest delay rate across ranked corridors
          </p>
        </SpotlightCard>

        <SpotlightCard className="p-4" spotlightColor="rgba(245, 158, 11, 0.15)" borderColor="rgba(245, 158, 11, 0.4)">
          <span className="text-xs font-medium text-neutral-500">Highest Delay Lane (watch)</span>
          <div className="text-xl font-bold font-mono text-amber-500 mt-1">
            {topDelayed ? laneLabel(topDelayed) : "—"}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {topDelayed ? `${topDelayed.delay_rate.toFixed(1)}% delay rate over ${topDelayed.volume} loads` : "No lane data"}
          </p>
        </SpotlightCard>
      </div>

      {/* Corridor Breakdown Table */}
      <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Ranked Freight Corridors (live)
        </h3>

        {rows.length === 0 ? (
          <p className="text-xs text-neutral-500">No lane data available.</p>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-medium font-mono">
                <th className="py-2.5 px-3">Freight Corridor</th>
                <th className="py-2.5 px-3 text-right">Volume</th>
                <th className="py-2.5 px-3 text-right">Avg Miles</th>
                <th className="py-2.5 px-3 text-right">Delay Rate</th>
                <th className="py-2.5 px-3 text-right">On-Time %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
              {rows.map((r) => (
                <tr key={r.lane} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                  <td className="py-3 px-3 font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{r.lane}</span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {r.volume} loads
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {r.avg_miles} mi
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                    {r.delay_rate.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-semibold">
                    <span
                      className={
                        100 - r.delay_rate >= 92
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-amber-600 dark:text-amber-400"
                      }
                    >
                      {formatPercent(100 - r.delay_rate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Autonomous Pipeline Protocol Checklist (Great UI Component) */}
      <PipelineChecklist />
    </div>
  );
};
