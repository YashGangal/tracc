import React, { useState, useEffect } from "react";
import { CarrierItem } from "../../lib/types";
import { MetrixSparkline } from "../codedvisuals/MetrixSparkline";
import { formatCurrency, formatPercent, cn } from "../../lib/utils";
import { ArrowUpDown, Search, ChevronRight, ChevronLeft, ShieldAlert, CheckCircle2, Building2 } from "lucide-react";

const PAGE_SIZE = 10;

interface CarrierLeaderboardProps {
  carriers: CarrierItem[];
  onSelectCarrier: (carrier: CarrierItem) => void;
  demo?: boolean;
}

export const CarrierLeaderboard: React.FC<CarrierLeaderboardProps> = ({
  carriers,
  onSelectCarrier,
  demo = false,
}) => {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<keyof CarrierItem>("onTimeRate");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [search, sortField, sortAsc, carriers.length]);

  const filtered = carriers
    .filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.mcNumber.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return 0;
    });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : safePage * PAGE_SIZE + 1;
  const to = Math.min(safePage * PAGE_SIZE + PAGE_SIZE, filtered.length);

  const handleSort = (field: keyof CarrierItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs flex flex-col justify-between">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Carrier Reliability Leaderboard
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-medium">
              {filtered.length} Active Partners
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Key SLA metrics, late cancellation penalties, and performance trend
            {demo && (
              <span className="ml-2 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                DEMO SNAPSHOT
              </span>
            )}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
          <label htmlFor="carrier-search" className="sr-only">
            Search carrier or MC number
          </label>
          <input
            id="carrier-search"
            type="text"
            placeholder="Search carrier or MC#..."
            aria-label="Search carrier or MC number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-100/80 dark:bg-neutral-800/80 rounded-md border border-neutral-200 dark:border-neutral-700 outline-none text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-medium select-none">
              <th className="py-2.5 pr-4 pl-1">Carrier</th>
              <th
                onClick={() => handleSort("totalLoads")}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                <div className="inline-flex items-center gap-1 justify-end">
                  Loads <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort("revenue")}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                <div className="inline-flex items-center gap-1 justify-end">
                  Revenue <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort("onTimeRate")}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                <div className="inline-flex items-center gap-1 justify-end">
                  On-Time <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
              <th
                onClick={() => handleSort("lateRate")}
                className="py-2.5 px-3 text-right cursor-pointer hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
              >
                <div className="inline-flex items-center gap-1 justify-end">
                  Late Rate <ArrowUpDown className="w-3 h-3 opacity-60" />
                </div>
              </th>
                <th className="py-2.5 px-3 text-right" title="Planning estimate from avg dispatched miles at 48 mph fleet average">Avg Duration*</th>
              <th className="py-2.5 px-3 text-center">Trend (30d)</th>
              <th className="py-2.5 pl-3 pr-1 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {visible.map((carrier) => {
              const isHighPerformer = carrier.onTimeRate >= 94;
              const isAtRisk = carrier.onTimeRate < 85;

              return (
                <tr
                  key={carrier.id}
                  onClick={() => onSelectCarrier(carrier)}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3 pr-4 pl-1 font-medium text-neutral-900 dark:text-neutral-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 text-neutral-700 dark:text-neutral-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {carrier.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-500 transition-colors">
                          {carrier.name}
                        </div>
                        <div className="font-mono text-[10px] text-neutral-400">
                          {carrier.mcNumber} · {carrier.rating}★
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {carrier.totalLoads.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-700 dark:text-neutral-300">
                    {formatCurrency(carrier.revenue)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-medium">
                    <div className="inline-flex flex-col items-end">
                      <span
                        className={cn(
                          isHighPerformer
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : isAtRisk
                            ? "text-red-600 dark:text-red-400 font-bold"
                            : "text-neutral-800 dark:text-neutral-200"
                        )}
                      >
                        {formatPercent(carrier.onTimeRate)}
                      </span>
                      {/* Mini visual fill bar */}
                      <div className="w-12 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden mt-1">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            isHighPerformer ? "bg-emerald-500" : isAtRisk ? "bg-red-500" : "bg-blue-500"
                          )}
                          style={{ width: `${carrier.onTimeRate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-600 dark:text-neutral-400">
                    {formatPercent(carrier.lateRate)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-500 dark:text-neutral-400">
                    {carrier.avgDeliveryHours}h
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="inline-flex justify-center">
                      <MetrixSparkline
                        data={carrier.sparklineData}
                        trend={carrier.trend}
                        width={60}
                        height={20}
                        animated={false}
                      />
                    </div>
                  </td>
                  <td className="py-3 pl-3 pr-1 text-right">
                    <span
                      className={cn(
                        "text-[10px] font-mono px-2 py-0.5 rounded border inline-block whitespace-nowrap",
                        carrier.status === "Active"
                          ? "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          : "border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      )}
                    >
                      {carrier.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="p-8 text-center text-neutral-400 space-y-1">
            <Building2 className="w-6 h-6 mx-auto text-neutral-400/80 mb-2" />
            <p className="font-medium text-neutral-600 dark:text-neutral-300">No carriers found</p>
            <p className="text-[11px] text-neutral-500">
              No carrier partner matches your query "{search}". Try searching by another name or MC number.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > 0 && (
        <div className="flex items-center justify-end gap-2 pt-3 text-xs font-mono text-neutral-500">
          <button
            onClick={() => setPage(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-md border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
            aria-label="Previous carriers"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="tabular-nums">
            {from}–{to} of {filtered.length.toLocaleString()}
          </span>
          <button
            onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
            disabled={safePage >= pageCount - 1}
            className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-md border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
            aria-label="Next carriers"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
