import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, Truck, User, Phone, MapPin, Calendar, Clock, DollarSign, ShieldAlert } from "lucide-react";
import { LoadItem } from "../../lib/types";
import { RiskMeter } from "../codedvisuals/RiskMeter";
import { ShapContributions } from "../codedvisuals/ShapContributions";
import { LoadTimeline } from "../codedvisuals/LoadTimeline";
import { formatCurrency, cn } from "../../lib/utils";

interface LoadDetailDrawerProps {
  load: LoadItem | null;
  onClose: () => void;
  onAskAI: (load: LoadItem) => void;
}

export const LoadDetailDrawer: React.FC<LoadDetailDrawerProps> = ({
  load,
  onClose,
  onAskAI,
}) => {
  React.useEffect(() => {
    if (!load) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load, onClose]);

  return (
    <AnimatePresence>
      {load && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
          />

          {/* Slide-out Drawer Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={load ? `Load ${load.id} details` : "Load details"}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl h-full flex flex-col z-10"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Load {load.id}
                </span>
                <span
                  className={cn(
                    "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border",
                    load.status === "High Risk"
                      ? "border-orange-500/20 text-orange-600 dark:text-orange-400 bg-orange-500/10"
                      : load.status === "Delayed"
                      ? "border-red-500/20 text-red-600 dark:text-red-400 bg-red-500/10"
                      : "border-emerald-500/20 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                  )}
                >
                  {load.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onAskAI(load)}
                  className="px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded-md border border-blue-200 dark:border-blue-900 flex items-center gap-1.5 hover:bg-blue-100/50 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <span>Ask AI</span>
                </button>
                <button
                  onClick={onClose}
                  className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 text-xs">
              {/* Route & Cargo Overview */}
              <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[11px] text-neutral-400 font-mono">Origin → Destination</div>
                    <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {load.origin} → {load.destination}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {load.distanceMiles} miles · {load.loadType} · {formatCurrency(load.revenue)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-neutral-400 font-mono">Customer</div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5">
                      {load.customer}
                    </div>
                  </div>
                </div>

                {/* Carrier & Driver */}
                <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-neutral-400 text-[10px] uppercase font-mono">Assigned Carrier</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 mt-0.5">
                      <Truck className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{load.carrierName}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-[10px] uppercase font-mono">Assigned Driver</span>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{load.driverName}</span>
                    </div>
                    {load.driverPhone && (
                      <div className="text-[10px] text-neutral-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-2.5 h-2.5" />
                        <span>{load.driverPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Late Delivery Prediction & SHAP Factors */}
              <div className="space-y-3 p-3.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Late Delivery ML Risk Analysis
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">{load.modelVersion || "ML risk model"}</span>
                </div>

                <RiskMeter probability={load.lateProbability} riskLevel={load.riskLevel} />

                {load.shapFactors && load.shapFactors.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    <ShapContributions factors={load.shapFactors} />
                  </div>
                )}
              </div>

              {/* Shipment Milestones Timeline */}
              <div className="space-y-3 p-3.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    Operational Milestone Timeline
                  </span>
                  <span className="text-[11px] font-mono text-neutral-500">
                    Scheduled: {load.scheduledDeliveryTime}
                  </span>
                </div>
                <LoadTimeline milestones={load.timeline} />
              </div>
            </div>

            {/* Footer action bar */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">
                Live backend record
              </span>
              <button
                onClick={() => onAskAI(load)}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-neutral-900 dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Ask AI About This Load</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
