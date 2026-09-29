import React, { useState } from "react";
import {
  Search,
  Bell,
  Moon,
  Sun,
  RefreshCw,
  SlidersHorizontal,
  Menu,
  LogOut,
} from "lucide-react";
import { AlertItem } from "../../lib/types";
import { cn } from "../../lib/utils";
import { AvatarStack, StackUser } from "../codedvisuals/AvatarStack";

const defaultDispatchTeam: StackUser[] = [
  { id: "1", name: "Alex Vance", role: "Senior Ops Controller", initials: "AV", status: "online", color: "bg-blue-600" },
  { id: "2", name: "Elena Rostova", role: "Lead Route Dispatcher", initials: "ER", status: "online", color: "bg-emerald-600" },
  { id: "3", name: "Marcus Cole", role: "Carrier Compliance Lead", initials: "MC", status: "online", color: "bg-indigo-600" },
  { id: "4", name: "AI Dispatch Bot", role: "Autonomous Fleet Engine", initials: "AI", status: "online", color: "bg-purple-600" },
  { id: "5", name: "Sarah Jenkins", role: "Logistics Specialist", initials: "SJ", status: "away", color: "bg-amber-600" },
];

interface TopBarProps {
  currentSection: string;
  activePeriod: string;
  onChangePeriod: (period: string) => void;
  onOpenSearch: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  theme: "dark" | "light";
  onToggleTheme: (e?: React.MouseEvent) => void;
  alerts: AlertItem[];
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  lastUpdatedSeconds: number;
  onOpenMobileMenu?: () => void;
  live?: boolean;
  team?: StackUser[];
  onLogout?: () => void;
  userName?: string;
  userRole?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentSection,
  activePeriod,
  onChangePeriod,
  onOpenSearch,
  onRefreshData,
  isRefreshing,
  theme,
  onToggleTheme,
  alerts,
  onOpenAlerts,
  onOpenSettings,
  lastUpdatedSeconds,
  onOpenMobileMenu,
  live = true,
  team,
  onLogout,
  userName,
  userRole,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadAlerts = alerts.filter((a) => !a.resolved);

  return (
    <header className="h-14 border-b border-neutral-200 dark:border-neutral-800 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* Left zone: Mobile toggle & Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-xs min-w-0">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-1.5 rounded-md text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900"
          title="Open menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 font-medium text-neutral-400 dark:text-neutral-500 truncate">
          <span className="text-neutral-900 dark:text-neutral-100 font-extrabold tracking-tight">
            Tracc
          </span>
          <span>/</span>
          <span className="hidden sm:inline">Operations</span>
          <span className="hidden sm:inline">/</span>
          <span className="font-semibold text-neutral-800 dark:text-neutral-200 capitalize truncate">
            {currentSection}
          </span>
        </div>

        {/* Live sync pulse */}
        <div className="hidden md:flex items-center gap-1.5 ml-2 pl-3 border-l border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-400">
          <span className="relative flex h-2 w-2">
            <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75", live ? "animate-ping bg-emerald-400" : "bg-sky-400")} />
            <span className={cn("relative inline-flex rounded-full h-2 w-2", live ? "bg-emerald-500" : "bg-sky-500")} />
          </span>
          <span className="font-mono">
            {isRefreshing ? "Syncing..." : live ? `Live · ${lastUpdatedSeconds}s ago` : "Demo · offline"}
          </span>
        </div>
      </div>

      {/* Right zone: Actions, search, theme, profile */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Global Search trigger */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 bg-neutral-100/70 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-800 transition-colors"
          title="Search loads, carriers, SOPs (⌘K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Search loads, SOPs...</span>
          <kbd className="hidden sm:inline-block font-mono text-[10px] bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500 px-1.5 py-0.5 rounded border border-neutral-300/60 dark:border-neutral-700">
            ⌘K
          </kbd>
        </button>

        {/* Period indicator (display-only: backend serves trailing-14-day windows) */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800">
          <span>{activePeriod}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefreshData}
          disabled={isRefreshing}
          className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-md transition-colors"
          title="Refresh operational data"
        >
          <RefreshCw
            className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-blue-500")}
          />
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 relative text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-md transition-colors"
            title="Operational Alerts"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadAlerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-3 z-50 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Operational Alerts ({unreadAlerts.length})
                </span>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    onOpenAlerts();
                  }}
                  className="text-[11px] text-blue-500 hover:underline font-medium"
                >
                  View All
                </button>
              </div>

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800/80 max-h-64 overflow-y-auto mt-1">
                {alerts.slice(0, 3).map((alt) => (
                  <div key={alt.id} className="py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate pr-2">
                        {alt.title}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                        {alt.timestamp}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
                      {alt.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={(e) => onToggleTheme(e)}
          className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-md transition-colors cursor-pointer"
          title={theme === "dark" ? "Current: Dark Mode (Click for Light Mode)" : "Current: Light Mode (Click for Dark Mode)"}
          aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun className="w-3.5 h-3.5 text-neutral-400 hover:text-amber-400 transition-colors" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-neutral-600 hover:text-neutral-900 transition-colors" />
          )}
        </button>

        {/* Quick Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-md transition-colors"
          title="Settings & Motion Control"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Active Dispatch Team Avatar Stack */}
        <div className="flex items-center gap-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
          <div className="hidden sm:block text-right text-xs leading-tight mr-1">
            <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-[11px] truncate max-w-[140px]">
              {userName || "Ops Desk"}
            </div>
            <div className="text-[10px] text-emerald-500 font-mono">{userRole || "live session"}</div>
          </div>
          <AvatarStack users={team && team.length > 0 ? team : defaultDispatchTeam} limit={3} size="sm" variant="spring-tilt" />
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 text-neutral-500 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-md transition-colors"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
