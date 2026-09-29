import React from "react";
import { AlertTriangle, Clock, ArrowRight, ShieldAlert, Sparkles, CheckCircle } from "lucide-react";
import { LoadItem, CarrierItem } from "../../lib/types";
import { RiskMeter } from "../codedvisuals/RiskMeter";
import { cn } from "../../lib/utils";

interface RiskPanelProps {
  highRiskLoads: LoadItem[];
  delayedLoads: LoadItem[];
  carriersUnderReview: CarrierItem[];
  onSelectLoad: (load: LoadItem) => void;
  onSelectCarrier: (carrier: CarrierItem) => void;
  onAskAIAboutLoad: (load: LoadItem) => void;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({
  highRiskLoads,
  delayedLoads,
  carriersUnderReview,
  onSelectLoad,
  onSelectCarrier,
  onAskAIAboutLoad,
}) => {
  return (
    <div className="p-4 sm:p-5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200/80 dark:border-neutral-800 mb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider text-xs">
              Attention Required
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-medium">
            {highRiskLoads.length + delayedLoads.length + carriersUnderReview.length} Exceptions
          </span>
        </div>

        {/* Exceptions list */}
        <div className="space-y-3">
          {/* High risk ML predictions */}
          {highRiskLoads.slice(0, 2).map((load) => (
            <div
              key={load.id}
              className="p-3 rounded-lg border border-orange-200/80 dark:border-orange-950/60 bg-orange-50/40 dark:bg-orange-950/10 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  <button
                    onClick={() => onSelectLoad(load)}
                    className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100 hover:text-blue-500 underline-offset-2 hover:underline"
                  >
                    Load {load.id}
                  </button>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.2 rounded border border-orange-500/20">
                    High Risk
                  </span>
                </div>
                <RiskMeter probability={load.lateProbability} compact />
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-300">
                {load.origin} → {load.destination} ({load.carrierName})
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                {load.shapFactors?.[0]?.description || "Critical delay probability detected."}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-orange-200/50 dark:border-orange-900/30 text-xs">
                <button
                  onClick={() => onSelectLoad(load)}
                  className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white font-medium flex items-center gap-1 text-[11px]"
                >
                  View Details <ArrowRight className="w-3 h-3" />
                </button>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <button
                  onClick={() => onAskAIAboutLoad(load)}
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Sparkles className="w-3 h-3" /> Ask Copilot
                </button>
              </div>
            </div>
          ))}

          {/* Delayed loads */}
          {delayedLoads.slice(0, 1).map((load) => (
            <div
              key={load.id}
              className="p-3 rounded-lg border border-red-200/80 dark:border-red-950/60 bg-red-50/40 dark:bg-red-950/10"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <button
                    onClick={() => onSelectLoad(load)}
                    className="font-mono font-bold text-xs text-neutral-900 dark:text-neutral-100 hover:text-blue-500 underline-offset-2 hover:underline"
                  >
                    Load {load.id}
                  </button>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.2 rounded border border-red-500/20">
                    Delayed
                  </span>
                </div>
                <span className="text-xs font-mono font-semibold text-red-600 dark:text-red-400">
                  +{load.delayHours}h behind
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300">
                {load.origin} → {load.destination} · Driver: {load.driverName}
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                {load.shapFactors?.[0]?.description}
              </p>

              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-red-200/50 dark:border-red-900/30 text-xs">
                <button
                  onClick={() => onSelectLoad(load)}
                  className="text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white font-medium flex items-center gap-1 text-[11px]"
                >
                  Inspect Timeline <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {/* Underperforming carrier */}
          {carriersUnderReview.slice(0, 1).map((carrier) => (
            <div
              key={carrier.id}
              className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                    {carrier.name}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    ({carrier.mcNumber})
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20">
                  Under Review
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                On-time rate dropped to <strong className="text-red-500 font-mono">{carrier.onTimeRate}%</strong> with {carrier.lateRate}% late deliveries.
              </p>
              <button
                onClick={() => onSelectCarrier(carrier)}
                className="mt-2 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                Review Carrier Profile <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-3 border-t border-neutral-200/80 dark:border-neutral-800 mt-4 text-[11px] text-neutral-400 flex items-center justify-between">
        <span>Grounded in synthetic operational data</span>
        <span className="font-mono">PRD MVP Compliance</span>
      </div>
    </div>
  );
};
