import React, { useState } from "react";
import { TrendingUp, Filter, ShieldAlert, Sparkles, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { LoadItem } from "../../lib/types";
import { RiskMeter } from "../codedvisuals/RiskMeter";
import { ShapContributions } from "../codedvisuals/ShapContributions";
import { formatCurrency, cn } from "../../lib/utils";

interface PredictionsViewProps {
  loads: LoadItem[];
  onSelectLoad: (load: LoadItem) => void;
  onAskCopilot: (query: string) => void;
  benchmark?: {
    best_model?: string;
    benchmark?: Record<string, { accuracy?: number; precision?: number; recall?: number; roc_auc?: number }>;
  } | null;
}

export const PredictionsView: React.FC<PredictionsViewProps> = ({
  loads,
  onSelectLoad,
  onAskCopilot,
  benchmark = null,
}) => {
  const [filterRisk, setFilterRisk] = useState<"All" | "High" | "Critical" | "Low">("All");

  const filteredLoads = loads.filter((l) => {
    if (filterRisk === "All") return true;
    if (filterRisk === "High") return l.riskLevel === "High" || l.riskLevel === "Critical";
    if (filterRisk === "Critical") return l.riskLevel === "Critical";
    if (filterRisk === "Low") return l.riskLevel === "Low";
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <span>Late Delivery Risk Prediction & SHAP Engine</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {benchmark?.best_model
              ? `ML model (${benchmark.best_model}) predicting late appointment delivery probability with feature attribution.`
              : "ML model predicting late appointment delivery probability with feature attribution."}
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg text-xs font-medium self-start sm:self-auto border border-neutral-200 dark:border-neutral-800">
          {(["All", "High", "Critical", "Low"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRisk(r)}
              className={cn(
                "px-3 py-1 rounded-md transition-colors",
                filterRisk === r
                  ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 shadow-xs font-semibold"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              )}
            >
              {r === "All" ? "All Loads" : `${r} Risk`}
            </button>
          ))}
        </div>
      </div>

      {/* Model Performance Baseline Bar (live benchmark when available) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/40 text-xs">
        <div>
          <span className="text-[11px] text-neutral-400 font-mono">Validation ROC-AUC</span>
          <div className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {benchmark?.benchmark?.[benchmark.best_model || ""]?.roc_auc != null
              ? Number(benchmark.benchmark[benchmark.best_model || ""].roc_auc).toFixed(3)
              : "—"}
          </div>
        </div>
        <div>
          <span className="text-[11px] text-neutral-400 font-mono">Late Recall (Safety)</span>
          <div className="font-mono text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {benchmark?.benchmark?.[benchmark.best_model || ""]?.recall != null
              ? `${(Number(benchmark.benchmark[benchmark.best_model || ""].recall) * 100).toFixed(1)}%`
              : "—"}
          </div>
        </div>
        <div>
          <span className="text-[11px] text-neutral-400 font-mono">Precision (Late)</span>
          <div className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
            {benchmark?.benchmark?.[benchmark.best_model || ""]?.precision != null
              ? `${(Number(benchmark.benchmark[benchmark.best_model || ""].precision) * 100).toFixed(1)}%`
              : "—"}
          </div>
        </div>
        <div>
          <span className="text-[11px] text-neutral-400 font-mono">Active Model</span>
          <div className="font-mono text-xs font-medium text-blue-500 mt-1">
            {benchmark?.best_model
              ? `${benchmark.best_model.toLowerCase().replace(/ /g, "-")}-v1.0`
              : "—"}
          </div>
        </div>
      </div>

      {/* Grid of Predicted Loads */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredLoads.map((load) => {
          const isCritical = load.lateProbability >= 0.8;
          return (
            <div
              key={load.id}
              className={cn(
                "p-4 sm:p-5 rounded-xl border bg-white dark:bg-neutral-900/60 shadow-xs space-y-4 transition-all hover:border-neutral-300 dark:hover:border-neutral-700",
                isCritical
                  ? "border-orange-200 dark:border-orange-950/60"
                  : "border-neutral-200/80 dark:border-neutral-800"
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      Load {load.id}
                    </span>
                    <span className="text-xs text-neutral-400">·</span>
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {load.carrierName}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {load.origin} → {load.destination} ({load.distanceMiles} mi)
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs text-neutral-500 block">
                    ETA: {load.eta}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    Target: {load.scheduledDeliveryTime}
                  </span>
                </div>
              </div>

              {/* Risk Meter component */}
              <RiskMeter probability={load.lateProbability} riskLevel={load.riskLevel} />

              {/* Contributing SHAP factors */}
              {load.shapFactors && (
                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                  <ShapContributions factors={load.shapFactors} />
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-xs">
                <button
                  onClick={() => onSelectLoad(load)}
                  className="font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 text-[11px]"
                >
                  Inspect Load Timeline <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onAskCopilot(`Explain why load ${load.id} is predicted ${Math.round(load.lateProbability * 100)}% late and what dispatcher interventions are recommended`)}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 text-[11px]"
                >
                  <Sparkles className="w-3 h-3" />
                  Ask Copilot for Interventions
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
