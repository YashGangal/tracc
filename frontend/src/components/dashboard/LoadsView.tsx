import React, { useEffect, useState } from "react";
import { Search, ChevronRight, ChevronLeft, ArrowUpDown, Truck } from "lucide-react";
import { LoadItem, LoadStatus } from "../../lib/types";
import { formatCurrency, cn } from "../../lib/utils";
import { RiskMeter } from "../codedvisuals/RiskMeter";
import { fetchLoads, fetchLoadsSummary } from "../../lib/backend";

interface LoadsViewProps {
  onSelectLoad: (load: LoadItem) => void;
  statusFilter?: string;
  reloadKey?: number;
  demo?: boolean;
}

const PAGE_SIZE = 50;

const CHIP_TO_BACKEND: Record<string, string> = {
  all: "all",
  "In Transit": "in_transit",
  Delayed: "delayed",
  Delivered: "delivered",
  Pending: "pending",
  Cancelled: "cancelled",
};

function useDebounced(v: string, ms = 350) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export const LoadsView: React.FC<LoadsViewProps> = ({
  onSelectLoad,
  statusFilter: initialStatusFilter = "all",
  reloadKey = 0,
  demo = false,
}) => {
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>(initialStatusFilter);
  const [selectedType, setSelectedType] = useState<string>("All");
  const [sortField, setSortField] = useState<keyof LoadItem>("id");
  const [sortAsc, setSortAsc] = useState(false);
  const [loads, setLoads] = useState<LoadItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dq = useDebounced(search);

  const statuses = ["all", "In Transit", "Delayed", "Delivered", "Pending", "Cancelled"];
  const loadTypes = ["All", "Dry Van", "Reefer", "Flatbed", "Step Deck"];

  useEffect(() => {
    setOffset(0);
  }, [selectedStatus, dq, reloadKey]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const backendStatus = CHIP_TO_BACKEND[selectedStatus] ?? "all";
        const [res, sum] = await Promise.all([
          fetchLoads({ status: backendStatus, search: dq || undefined, limit: PAGE_SIZE, offset }),
          fetchLoadsSummary().catch(() => null),
        ]);
        if (!alive) return;
        setLoads(res.items);
        if (dq) {
          setTotal(offset + res.items.length);
        } else if (sum) {
          const key = backendStatus === "all" ? "total" : backendStatus;
          setTotal(typeof sum[key] === "number" ? sum[key] : offset + res.items.length);
        } else {
          setTotal(offset + res.items.length);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load shipments");
        setLoads([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [selectedStatus, dq, offset, reloadKey]);

  const filtered = loads
    .filter((l) => selectedType === "All" || l.loadType === selectedType)
    .sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      if (typeof valA === "string" && typeof valB === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });

  const handleSort = (field: keyof LoadItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Truck className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
            <span>Active Freight Loads & Fleet Telemetry</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {loading
              ? "Loading live shipments…"
              : `Showing ${filtered.length} of ${total.toLocaleString()} shipments · newest first · 50 per page`}
            {demo && !loading && (
              <span className="ml-2 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                DEMO SNAPSHOT
              </span>
            )}
          </p>
        </div>

        {/* Global Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
          <span className="sr-only">Search shipments by load number, city, or state</span>
          <input
            type="text"
            aria-label="Search shipments by load number, city, or state"
            placeholder="Search load #, city, or state… (server-side)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 outline-none text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>
      </div>

      {/* Filter Tabs Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          {statuses.map((st) => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition-colors capitalize",
                selectedStatus === st
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              )}
            >
              {st === "all" ? "All Loads" : st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-neutral-400 text-[11px]">Trailer:</span>
          {loadTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-medium transition-colors border",
                selectedType === t
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Loads Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-medium">
              <th
                aria-sort={sortField === "id" ? (sortAsc ? "ascending" : "descending") : "none"}
                className="py-3 px-3"
              >
                <button
                  onClick={() => handleSort("id")}
                  aria-label="Sort by Load ID"
                  className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  Load ID <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3">Route (Origin → Destination)</th>
              <th className="py-3 px-3">Carrier / Driver</th>
              <th className="py-3 px-3">Trailer Type</th>
              <th
                aria-sort={sortField === "revenue" ? (sortAsc ? "ascending" : "descending") : "none"}
                className="py-3 px-3 text-right"
              >
                <button
                  onClick={() => handleSort("revenue")}
                  aria-label="Sort by Revenue"
                  className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  Revenue <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th
                aria-sort={sortField === "lateProbability" ? (sortAsc ? "ascending" : "descending") : "none"}
                className="py-3 px-3 text-center"
              >
                <button
                  onClick={() => handleSort("lateProbability")}
                  aria-label="Sort by Late Risk"
                  className="inline-flex items-center gap-1 cursor-pointer hover:text-neutral-800 dark:hover:text-neutral-200 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
                >
                  Late Risk <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80">
            {filtered.map((load) => (
              <tr
                key={load.id}
                tabIndex={0}
                role="button"
                aria-label={`Open load ${load.id}: ${load.origin} to ${load.destination}, ${load.status}`}
                onClick={() => onSelectLoad(load)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectLoad(load);
                  }
                }}
                className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer group focus-visible:outline-2 focus-visible:outline-blue-500 focus-visible:-outline-offset-2"
              >
                <td className="py-3 px-3 font-mono font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-500 transition-colors">
                  {load.id}
                </td>
                <td className="py-3 px-3">
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">
                    {load.origin} → {load.destination}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    {load.distanceMiles} miles · Scheduled: {load.scheduledDeliveryTime}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="font-medium text-neutral-800 dark:text-neutral-200">
                    {load.carrierName}
                  </div>
                  <div className="text-[10px] text-neutral-400 font-mono">
                    Driver: {load.driverName}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className="font-mono text-neutral-600 dark:text-neutral-300">
                    {load.loadType}
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-mono font-medium text-neutral-800 dark:text-neutral-200">
                  {formatCurrency(load.revenue)}
                </td>
                <td className="py-3 px-3 text-center">
                  <div className="inline-flex justify-center">
                    {load.modelVersion || load.lateProbability > 0 ? (
                      <RiskMeter probability={load.lateProbability} compact />
                    ) : (
                      <span className="font-mono text-[11px] text-neutral-400" title="Open the load to score ML risk">
                        —
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span
                    className={cn(
                      "text-[10px] font-mono px-2 py-0.5 rounded border inline-block whitespace-nowrap",
                      load.status === "High Risk"
                        ? "border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-500/10"
                        : load.status === "Delayed"
                        ? "border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/10"
                        : load.status === "In Transit"
                        ? "border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/10"
                        : load.status === "Delivered"
                        ? "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                        : "border-neutral-500/20 text-neutral-600 dark:text-neutral-400 bg-neutral-500/10"
                    )}
                  >
                    {load.status}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    Inspect <ChevronRight className="w-3 h-3" />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && (
          <p className="p-6 text-center text-xs text-neutral-400">Loading live shipments…</p>
        )}
        {!loading && error && (
          <p className="p-6 text-center text-xs text-red-500">{error}</p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p className="p-6 text-center text-xs text-neutral-400">No shipments match — try another status or search.</p>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-2 text-xs font-mono text-neutral-500">
        <button
          onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0 || loading}
          className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-md border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="tabular-nums">
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total.toLocaleString()}
        </span>
        <button
          onClick={() => setOffset(offset + PAGE_SIZE)}
          disabled={loading || offset + PAGE_SIZE >= total}
          className="p-2 min-h-[44px] min-w-[44px] grid place-items-center rounded-md border border-neutral-200 dark:border-neutral-800 disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
