// Live backend access + normalization to Metrix UI types.
// Backend truth (/api/v1): LoadOut uses int ids + lowercase statuses,
// CarrierPerformance, AlertOut, PredictionOut/SHAPFactor, SummaryKPIs.
import { apiFetch } from "./api";
import type {
  LoadItem,
  LoadStatus,
  CarrierItem,
  AlertItem,
  DocumentItem,
  MetricData,
  ActivityEvent,
} from "./types";

export function mapStatus(s: string): LoadStatus {
  switch ((s || "").toLowerCase()) {
    case "delivered":
      return "Delivered";
    case "in_transit":
      return "In Transit";
    case "delayed":
      return "Delayed";
    case "cancelled":
      return "Cancelled";
    case "pending":
    case "assigned":
      return "Pending";
    default:
      return "Pending";
  }
}

export function mapRiskLevel(risk: string, prob: number): "Low" | "Medium" | "High" | "Critical" {
  if (prob >= 0.8) return "Critical";
  const r = (risk || "").toUpperCase();
  if (r === "HIGH") return "High";
  if (r === "MEDIUM") return "Medium";
  return "Low";
}

export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return String(iso);
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

export function normLoad(l: any): LoadItem {
  return {
    id: l.load_number ?? `L${l.id}`,
    dbId: typeof l.id === "number" ? l.id : undefined,
    customer: `Customer #${l.customer_id ?? "—"}`,
    carrierId: l.carrier_id != null ? `C-${l.carrier_id}` : "—",
    carrierName: l.carrier_name || "Unassigned",
    driverName: l.driver_name || "Unassigned",
    driverPhone: undefined,
    origin: [l.origin_city, l.origin_state].filter(Boolean).join(", "),
    destination: [l.destination_city, l.destination_state].filter(Boolean).join(", "),
    distanceMiles: Math.round(l.distance_miles ?? 0),
    revenue: l.revenue ?? 0,
    loadType: l.load_type || "Dry Van",
    status: mapStatus(l.status),
    pickupTime: l.pickup_datetime ?? l.actual_pickup_datetime ?? "",
    scheduledDeliveryTime: l.delivery_datetime ?? "",
    eta: l.delivery_datetime ?? l.pickup_datetime ?? "",
    lateProbability: 0,
    riskLevel: "Low",
    timeline: (l.delivery_events || []).map((e: any) => ({
      stage: String(e.event_type || "event").replace(/_/g, " "),
      time: e.event_timestamp || "",
      completed: true,
      statusNote: [e.location, e.description].filter(Boolean).join(" — ") || undefined,
    })),
  };
}

export function applyPrediction(load: LoadItem, p: any): LoadItem {
  const prob = p.late_probability ?? 0;
  return {
    ...load,
    lateProbability: prob,
    riskLevel: mapRiskLevel(p.risk_level, prob),
    modelVersion: p.model_version,
    shapFactors: (p.top_contributing_factors || []).map((f: any) => ({
      factor: f.factor_name,
      impact:
        (f.direction === "decreases_risk" ? -1 : 1) * (f.importance_value ?? 0),
      description: f.impact_description,
    })),
  };
}

export function normCarrier(c: any, perf?: any): CarrierItem {
  const p = perf || {};
  const total = p.total_loads ?? 0;
  const delivered = p.delivered_loads ?? 0;
  const delayed = p.delayed_loads ?? 0;
  const denom = delivered + delayed;
  const onTime = p.on_time_rate ?? (denom > 0 ? (delivered / denom) * 100 : 100);
  return {
    id: `C-${c.id}`,
    name: c.name,
    mcNumber: c.mc_number,
    totalLoads: total,
    revenue: Math.round(p.total_revenue ?? 0),
    onTimeRate: Math.round(onTime * 10) / 10,
    lateRate: Math.round((100 - onTime) * 10) / 10,
    cancellationRate: 0,
    avgDeliveryHours: p.average_transit_hours ?? 0,
    rating: c.rating ?? 0,
    status: c.status === "active" ? "Active" : c.status === "suspended" ? "Suspended" : "Under Review",
    trend: "neutral",
    sparklineData: Array(7).fill(Math.round(onTime * 10) / 10),
  };
}

const ALERT_TYPE_MAP: Record<string, AlertItem["type"]> = {
  delayed_load: "Delayed Load",
  high_risk_load: "High Risk",
  high_risk_carrier: "Carrier Drop",
  daily_ops_report: "Automation",
};

export function normAlert(a: any): AlertItem {
  const sev = (a.severity || "info").toLowerCase();
  return {
    id: String(a.id),
    type: ALERT_TYPE_MAP[a.alert_type] || "Automation",
    severity: sev === "high" || sev === "critical" ? "critical" : sev === "medium" ? "warning" : "info",
    title: a.title,
    entityId: a.load_id != null ? String(a.load_id) : a.carrier_id != null ? `C-${a.carrier_id}` : "",
    entityType: a.load_id != null ? "load" : a.carrier_id != null ? "carrier" : "system",
    reason: a.message,
    timestamp: fmtWhen(a.created_at),
    resolved: a.status !== "active",
    actionLabel: a.load_id != null ? "Inspect Load" : a.carrier_id != null ? "Review Carrier" : undefined,
  };
}

export function normDoc(d: any): DocumentItem {
  return {
    id: String(d.id),
    title: d.name,
    category: "SOP",
    fileType: (d.file_type || "md") as DocumentItem["fileType"],
    pages: d.chunk_count ?? 0,
    updatedAt: String(d.created_at || "").slice(0, 10),
    summary: `${d.chunk_count ?? 0} indexed chunks · uploaded by ${d.uploaded_by || "system"}`,
    content: "",
    sections: [],
  };
}

// ---- fetchers (all live, all throw ApiError on failure) ----

export async function fetchKpis(): Promise<MetricData & { inTransitLoads: number; pendingLoads: number }> {
  const k = await apiFetch("/analytics/kpis");
  return {
    totalLoads: k.total_loads,
    deliveredLoads: k.delivered_loads,
    delayedLoads: k.delayed_loads,
    inTransitLoads: k.in_transit_loads ?? 0,
    pendingLoads: k.pending_loads ?? 0,
    revenue: Math.round(k.total_revenue),
    avgRevenuePerLoad: Math.round(k.average_revenue_per_load * 100) / 100,
    onTimeDeliveryRate: k.on_time_delivery_rate,
    activeCarriers: k.active_carriers,
    activeDrivers: k.active_drivers,
  };
}

export interface TrendPoint {
  day: string;
  loads: number;
  delayed: number;
  revenue: number;
}

export async function fetchRevenueTrends(): Promise<TrendPoint[]> {
  const rows = await apiFetch("/analytics/revenue-trends");
  return (Array.isArray(rows) ? rows : []).map((r: any) => ({
    day: String(r.date || "").slice(5) || String(r.date),
    loads: r.loads ?? 0,
    delayed: r.delayed ?? 0,
    revenue: Math.round(r.revenue ?? 0),
  }));
}

export interface LaneRow {
  lane: string;
  volume: number;
  avg_miles: number;
  delay_rate: number;
}

export async function fetchLaneTrends(): Promise<LaneRow[]> {
  const rows = await apiFetch("/analytics/lane-trends");
  return Array.isArray(rows) ? rows : [];
}

export interface LoadsResult {
  items: LoadItem[];
  total: number | null; // backend returns a bare array → null (use stats/summary)
}

export async function fetchLoads(opts: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<LoadsResult> {
  const params = new URLSearchParams({
    limit: String(opts.limit ?? 50),
    offset: String(opts.offset ?? 0),
  });
  if (opts.status && opts.status !== "all") params.set("status", opts.status);
  if (opts.search) params.set("search", opts.search);
  const res = await apiFetch(`/loads?${params}`);
  const arr = res.items || res.loads || res || [];
  return {
    items: (Array.isArray(arr) ? arr : []).map(normLoad),
    total: typeof res.total === "number" ? res.total : null,
  };
}

export async function fetchLoadsSummary(): Promise<Record<string, number>> {
  return apiFetch("/loads/stats/summary");
}

export async function fetchLoadDetail(dbId: number): Promise<LoadItem> {
  return normLoad(await apiFetch(`/loads/${dbId}`));
}

export async function fetchPrediction(dbId: number): Promise<any> {
  return apiFetch(`/predictions/load/${dbId}`);
}

export async function fetchHighRisk(limit = 12): Promise<any[]> {
  const res = await apiFetch(`/predictions/batch/high-risk?limit=${limit}`);
  return Array.isArray(res) ? res : [];
}

export async function fetchBenchmark(): Promise<any> {
  return apiFetch("/predictions/benchmark");
}

export async function fetchCarriers(search = "", limit = 200): Promise<any[]> {
  const params = new URLSearchParams({ limit: String(limit), offset: "0" });
  if (search) params.set("search", search);
  const res = await apiFetch(`/carriers?${params}`);
  return Array.isArray(res) ? res : [];
}

export async function fetchTopCarriers(limit = 10): Promise<any[]> {
  const res = await apiFetch(`/analytics/carrier-performance?limit=${limit}`);
  return Array.isArray(res) ? res : [];
}

export function normTopCarrier(r: any): CarrierItem {
  const total = r.total_loads ?? 0;
  const onTime = r.on_time_rate ?? 100;
  return {
    id: `C-${r.carrier_id}`,
    name: r.carrier_name,
    mcNumber: "",
    totalLoads: total,
    revenue: Math.round(r.total_revenue ?? 0),
    onTimeRate: Math.round(onTime * 10) / 10,
    lateRate: Math.round((100 - onTime) * 10) / 10,
    cancellationRate: 0,
    avgDeliveryHours: (r as any).average_transit_hours ?? 0,
    rating: r.rating ?? 0,
    status: "Active",
    trend: "neutral",
    sparklineData: Array(7).fill(Math.round(onTime * 10) / 10),
  };
}

export async function fetchAlerts(status = "active"): Promise<AlertItem[]> {
  const params = new URLSearchParams({ status, limit: "100" });
  const res = await apiFetch(`/alerts?${params}`);
  const arr = res.items || res.alerts || (Array.isArray(res) ? res : []);
  return (Array.isArray(arr) ? arr : []).map(normAlert);
}

export async function resolveAlert(id: string): Promise<void> {
  await apiFetch(`/alerts/${id}/resolve`, { method: "POST" });
}

export async function triggerWorkflow(name: "workflow_a" | "workflow_b" | "workflow_c"): Promise<any> {
  return apiFetch(`/alerts/trigger/${name}`, { method: "POST" });
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const res = await apiFetch("/rag/documents?limit=100");
  const arr = Array.isArray(res) ? res : [];
  return arr.map(normDoc);
}

export async function fetchDocChunks(docId: string): Promise<{ heading: string; text: string; page: number }[]> {
  const res = await apiFetch(`/rag/documents/${docId}/chunks?limit=20`);
  return (res.chunks || []).map((c: any) => ({
    heading: `Chunk #${(c.chunk_index ?? 0) + 1}`,
    text: c.chunk_text || "",
    page: (c.chunk_index ?? 0) + 1,
  }));
}

export async function uploadDocument(file: File): Promise<void> {
  const fd = new FormData();
  fd.append("file", file);
  await apiFetch("/rag/upload", { method: "POST", formData: fd });
}

export async function copilotAgent(query: string): Promise<any> {
  return apiFetch("/agent/chat", { method: "POST", body: { query } });
}

export async function copilotSql(query: string): Promise<any> {
  return apiFetch("/copilot/query", { method: "POST", body: { query, mode: "text_to_sql" } });
}

export async function ragQuery(query: string): Promise<any> {
  return apiFetch("/rag/query", { method: "POST", body: { query } });
}

export function buildActivityFeed(alerts: AlertItem[], loads: LoadItem[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  alerts.slice(0, 3).forEach((a, i) => {
    events.push({
      id: `al-${a.id}`,
      time: a.timestamp,
      type: a.type === "Delayed Load" ? "delay" : a.type === "Carrier Drop" ? "carrier" : "automation",
      title: a.title,
      description: a.reason,
    });
  });
  loads.slice(0, 2).forEach((l, i) => {
    events.push({
      id: `ld-${l.id}`,
      time: "",
      type: l.status === "Delayed" ? "delay" : l.status === "Delivered" ? "delivery" : "risk",
      title: `Load ${l.id} ${l.status.toLowerCase()}: ${l.origin} → ${l.destination}`,
      description: `Carrier ${l.carrierName} · ${l.distanceMiles} mi`,
    });
  });
  return events.slice(0, 5);
}
