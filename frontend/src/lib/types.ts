export type LoadStatus = "Delivered" | "In Transit" | "Delayed" | "High Risk" | "Cancelled" | "Pending";

export interface LoadItem {
  id: string; // display id = backend load_number (e.g. L10001)
  dbId?: number; // numeric backend id for detail/prediction fetches
  modelVersion?: string;
  customer: string;
  carrierId: string;
  carrierName: string;
  driverName: string;
  driverPhone?: string;
  origin: string; // e.g. "Chicago, IL"
  destination: string; // e.g. "Dallas, TX"
  distanceMiles: number;
  revenue: number;
  loadType: "Dry Van" | "Reefer" | "Flatbed" | "Hazmat";
  status: LoadStatus;
  pickupTime: string;
  scheduledDeliveryTime: string;
  eta: string;
  lateProbability: number; // 0 to 1
  riskLevel: "Low" | "Medium" | "High" | "Critical";
  delayHours?: number;
  shapFactors?: {
    factor: string;
    impact: number; // positive = pushes toward late, negative = on-time
    description: string;
  }[];
  timeline: {
    stage: string;
    time: string;
    completed: boolean;
    statusNote?: string;
  }[];
}

export interface CarrierItem {
  id: string;
  name: string;
  mcNumber: string;
  totalLoads: number;
  revenue: number;
  onTimeRate: number; // %
  lateRate: number; // %
  cancellationRate: number; // %
  avgDeliveryHours: number;
  rating: number; // 1-5
  status: "Active" | "Under Review" | "Suspended";
  trend: "up" | "down" | "neutral";
  sparklineData: number[];
}

export interface AlertItem {
  id: string;
  type: "Delayed Load" | "High Risk" | "Carrier Drop" | "Compliance" | "Automation";
  severity: "critical" | "warning" | "info";
  title: string;
  entityId: string;
  entityType: "load" | "carrier" | "driver" | "system";
  reason: string;
  timestamp: string;
  resolved: boolean;
  actionLabel?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  category: "SOP" | "Policy" | "Manual" | "Compliance";
  fileType: "pdf" | "md" | "txt";
  pages: number;
  updatedAt: string;
  summary: string;
  content: string;
  sections: {
    heading: string;
    text: string;
    page: number;
  }[];
}

export interface MetricData {
  totalLoads: number;
  deliveredLoads: number;
  delayedLoads: number;
  revenue: number;
  avgRevenuePerLoad: number;
  onTimeDeliveryRate: number;
  activeCarriers: number;
  activeDrivers: number;
}

export interface ActivityEvent {
  id: string;
  time: string;
  type: "risk" | "delay" | "delivery" | "automation" | "carrier";
  title: string;
  description: string;
}
