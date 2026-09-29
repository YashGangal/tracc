import React from "react";
import {
  LayoutDashboard,
  Truck,
  TrendingUp,
  Building2,
  Sparkles,
  BookOpen,
  Bell,
  BarChart3,
  Settings,
  ChevronLeft,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { TraccMark } from "./TraccMark";
import { DitheredLogo } from "../ui/dithered-logo";
import { usePrefersReducedMotion } from "../ui/dotmatrix-hooks";
import { GithubCard } from "../codedvisuals/GithubCard";
import { LinkedinCard } from "../codedvisuals/LinkedinCard";

export type NavSection =
  | "overview"
  | "loads"
  | "predictions"
  | "carriers"
  | "copilot"
  | "knowledge"
  | "alerts"
  | "analytics"
  | "settings";

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
  highlight?: boolean;
}

interface SidebarProps {
  currentSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  highRiskCount: number;
  unresolvedAlertsCount: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  collapsed,
  onToggleCollapse,
  highRiskCount,
  unresolvedAlertsCount,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const reduceMotion = usePrefersReducedMotion();
  // Interactive dithered brand mark tuned for 28px: fine grid so the dots
  // stay ~1px and the rest state matches the static logo. Same white-tile
  // artwork in both themes, matching the login brand tile.
  const brandMark = reduceMotion ? (
    <TraccMark size={28} />
  ) : (
    <DitheredLogo
      imageSrc="/tracc-mark-login.svg"
      className="h-7 w-7 overflow-hidden rounded-lg text-[#151515] ring-1 ring-black/10"
      gridSize={30}
      scale={0.95}
      dotScale={1.6}
      cornerRadius={0.25}
      accentColor="#2948f5"
    />
  );
  const navItems: NavItem[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "loads", label: "Loads", icon: Truck },
    {
      id: "predictions",
      label: "Predictions",
      icon: TrendingUp,
      badge: highRiskCount > 0 ? `${highRiskCount} Risk` : undefined,
      badgeColor: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    },
    { id: "carriers", label: "Carriers", icon: Building2 },
    {
      id: "copilot",
      label: "AI Copilot",
      icon: Sparkles,
      highlight: true,
    },
    { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
    {
      id: "alerts",
      label: "Alerts Center",
      icon: Bell,
      badge: unresolvedAlertsCount > 0 ? `${unresolvedAlertsCount}` : undefined,
      badgeColor: "text-red-500 bg-red-500/10 border-red-500/20",
    },
    { id: "analytics", label: "Analytics & BI", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const handleItemClick = (id: NavSection) => {
    onSelectSection(id);
    if (isMobileOpen && onCloseMobile) {
      onCloseMobile();
    }
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand header */}
        <div className="h-14 border-b border-neutral-200 dark:border-neutral-800 px-3.5 flex items-center justify-between">
          {collapsed && !isMobileOpen ? (
            <button
              onClick={onToggleCollapse}
              className="mx-auto shrink-0"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              {brandMark}
            </button>
          ) : (
            <div className="flex items-center gap-2.5 overflow-hidden">
              {brandMark}
              {(!collapsed || isMobileOpen) && (
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="font-extrabold text-[17px] tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                    Tracc
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium border border-blue-500/20">
                    AI OPS
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Desktop collapse toggle or mobile close (logo expands when collapsed) */}
          {isMobileOpen ? (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              title="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          ) : collapsed ? null : (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation list */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-xs font-medium transition-colors group relative cursor-pointer",
                  isActive
                    ? "bg-neutral-100 text-neutral-950 dark:bg-neutral-900 dark:text-neutral-50 shadow-xs font-semibold"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                )}
                title={collapsed && !isMobileOpen ? item.label : undefined}
              >
                {/* Active marker pill */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-neutral-900 dark:bg-neutral-100" />
                )}

                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isActive
                      ? "text-neutral-900 dark:text-neutral-100"
                      : "text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-300",
                    item.highlight && "text-blue-500"
                  )}
                />

                {(!collapsed || isMobileOpen) && (
                  <span className="truncate flex-1 text-left flex items-center justify-between">
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-mono border",
                          item.badgeColor
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Developer & System Section */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
        {/* Great UI Social Cards (GitHub Card & LinkedIn Card) */}
        {!collapsed || isMobileOpen ? (
          <div className="p-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 space-y-2">
            <div className="flex items-center gap-2">
              <img
                src="https://github.com/YashGangal.png"
                alt="Yash Gangal"
                className="w-7 h-7 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover shadow-xs"
              />
              <div className="min-w-0 flex-1 text-left">
                <div className="text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                  Yash Gangal
                </div>
                <div className="text-[9px] text-neutral-500 truncate">
                  Creator & Architect
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-1.5 border-t border-neutral-200/60 dark:border-neutral-800/80">
              <GithubCard
                username="YashGangal"
                name="Yash Gangal"
                href="https://github.com/YashGangal"
                text="Explore"
                linkText="GitHub Profile"
                align="left"
                themeScheme="green"
                className="text-[11px] justify-between w-full"
                labelClassName="text-[10px] text-neutral-500 dark:text-neutral-400"
                linkClassName="text-[11px] font-medium text-neutral-900 dark:text-neutral-200"
                popoverClassName="left-0 -translate-x-0 w-76 text-left"
              />
              <LinkedinCard
                username="yash-gangal"
                name="Yash Gangal"
                href="https://www.linkedin.com/in/yash-gangal/"
                text="Connect on"
                linkText="LinkedIn"
                align="left"
                className="text-[11px] justify-between w-full"
                labelClassName="text-[10px] text-neutral-500 dark:text-neutral-400"
                linkClassName="text-[11px] font-medium text-[#0A66C2] dark:text-blue-400"
                popoverClassName="left-0 -translate-x-0 w-76 text-left"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <GithubCard
              username="YashGangal"
              name="Yash Gangal"
              href="https://github.com/YashGangal"
              text=""
              linkText={
                <div className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                </div>
              }
              align="left"
              themeScheme="green"
              popoverClassName="left-8 -translate-x-0 w-76 text-left"
            />
            <LinkedinCard
              username="yash-gangal"
              name="Yash Gangal"
              href="https://www.linkedin.com/in/yash-gangal/"
              text=""
              linkText={
                <div className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[#0A66C2] transition-colors">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.59 1.59 0 0 0 0-3.18 1.59 1.59 0 0 0 0 3.18m1.4 9.74v-8.37H5.06v8.37h2.8z" />
                  </svg>
                </div>
              }
              align="left"
              popoverClassName="left-8 -translate-x-0 w-76 text-left"
            />
          </div>
        )}

        {/* Read-Only Guard Info */}
        {!collapsed || isMobileOpen ? (
          <div className="p-2 rounded-lg bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200/60 dark:border-neutral-800/80 text-[10px] text-neutral-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">Human Approval Guard Active</span>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen sticky top-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 z-40 transition-[width] duration-200 ease-out select-none",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-64 max-w-[80vw] h-full bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 z-10 shadow-2xl flex flex-col">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
