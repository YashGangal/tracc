import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, SlidersHorizontal, Moon, Sun, ShieldCheck } from "lucide-react";
import { cn } from "../../lib/utils";
import { GithubCard } from "../codedvisuals/GithubCard";
import { LinkedinCard } from "../codedvisuals/LinkedinCard";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "dark" | "light";
  onToggleTheme: (e?: React.MouseEvent) => void;
  onSelectTheme?: (theme: "dark" | "light", e?: React.MouseEvent) => void;
  motionEnabled: boolean;
  onToggleMotion: () => void;
  refreshInterval: number;
  onChangeRefreshInterval: (interval: number) => void;
  riskThreshold: number;
  onChangeRiskThreshold: (val: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  onSelectTheme,
  motionEnabled,
  onToggleMotion,
  refreshInterval,
  onChangeRefreshInterval,
  riskThreshold,
  onChangeRiskThreshold,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden text-xs z-10"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-neutral-500" />
                <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  Operations & Display Settings
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4">
              {/* Theme setting */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1">
                <div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">Color Appearance</div>
                  <div className="text-[11px] text-neutral-500">Vercel monochrome dark or high-contrast light</div>
                </div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 self-start sm:self-auto">
                  <button
                    onClick={(e) => {
                      if (onSelectTheme) onSelectTheme("light", e);
                      else if (theme !== "light") onToggleTheme(e);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                      theme === "light"
                        ? "bg-white text-neutral-900 shadow-xs font-semibold"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    )}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={(e) => {
                      if (onSelectTheme) onSelectTheme("dark", e);
                      else if (theme !== "dark") onToggleTheme(e);
                    }}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer",
                      theme === "dark"
                        ? "bg-neutral-900 text-white dark:bg-neutral-700 shadow-xs font-semibold"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    )}
                  >
                    <Moon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              {/* Framer Motion Kill-Switch */}
              <div className="flex items-center justify-between py-1 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                <div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">Micro-Animations & Motion</div>
                  <div className="text-[11px] text-neutral-500">
                    Framer Motion transitions, sparklines, and flow indicators
                  </div>
                </div>
                <button
                  onClick={onToggleMotion}
                  className={cn(
                    "px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer",
                    motionEnabled
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                      : "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                  )}
                >
                  {motionEnabled ? "Enabled" : "Reduced"}
                </button>
              </div>

              {/* Live Data Refresh Interval */}
              <div className="flex items-center justify-between py-1 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                <div>
                  <div className="font-medium text-neutral-900 dark:text-neutral-100">Auto-Refresh Interval</div>
                  <div className="text-[11px] text-neutral-500">Fleet GPS and ELD telemetry sync cycle</div>
                </div>
                <select
                  value={refreshInterval}
                  onChange={(e) => onChangeRefreshInterval(Number(e.target.value))}
                  className="px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 font-mono text-neutral-800 dark:text-neutral-200 outline-none"
                >
                  <option value={15}>15s (Real-time)</option>
                  <option value={30}>30s (Balanced)</option>
                  <option value={60}>60s (Low Network)</option>
                </select>
              </div>

              {/* Risk Alert Threshold */}
              <div className="py-1 border-t border-neutral-100 dark:border-neutral-800 pt-3 space-y-1.5">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">Late Risk Trigger Threshold</div>
                    <div className="text-[11px] text-neutral-500">Alert dispatch when ML late probability exceeds:</div>
                  </div>
                  <span className="font-mono font-bold text-orange-500">{riskThreshold}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={90}
                  step={5}
                  value={riskThreshold}
                  onChange={(e) => onChangeRiskThreshold(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* PRD Safety Guard UX */}
              <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                  <strong>Human-in-the-Loop Enforced:</strong> All AI tool executions remain read-only. Rate changes, tender cancellations, or carrier dispatches always require dispatcher validation.
                </div>
              </div>

              {/* Platform Architect & Creator (Great UI GithubCard & LinkedinCard) */}
              <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-mono text-neutral-400">
                    Platform Architect & Creator
                  </div>
                  <span className="text-[10px] text-neutral-400">Hover links to preview cards</span>
                </div>

                <div className="p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="https://github.com/YashGangal.png"
                      alt="Yash Gangal"
                      className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover shadow-xs"
                    />
                    <div>
                      <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        Yash Gangal
                      </div>
                      <div className="text-[10px] text-neutral-500">
                        Lead System Architect
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <GithubCard
                      username="YashGangal"
                      name="Yash Gangal"
                      href="https://github.com/YashGangal"
                      text="Code on"
                      linkText="GitHub"
                      themeScheme="green"
                      isDark={theme === "dark"}
                      className="text-xs"
                      popoverClassName="w-80 text-left"
                    />
                    <LinkedinCard
                      username="yash-gangal"
                      name="Yash Gangal"
                      href="https://www.linkedin.com/in/yash-gangal/"
                      text="Profile on"
                      linkText="LinkedIn"
                      className="text-xs"
                      linkClassName="text-[#0A66C2] dark:text-blue-400 font-semibold"
                      popoverClassName="w-80 text-left"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 flex justify-end">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium hover:bg-neutral-800 dark:hover:bg-neutral-100 cursor-pointer"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
