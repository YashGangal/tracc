import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils";

export interface StackUser {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  initials: string;
  status?: "online" | "busy" | "away" | "offline";
  color?: string;
}

interface AvatarStackProps {
  users: StackUser[];
  limit?: number;
  size?: "sm" | "md" | "lg";
  variant?: "spring-tilt" | "spring-box" | "slide-blur";
  className?: string;
  showTooltip?: boolean;
}

/**
 * AvatarStack component inspired by Great UI (great-ui.com)
 * Features spring-tilt physics, magnetic hover elevation, and interactive status tooltips.
 */
export const AvatarStack: React.FC<AvatarStackProps> = ({
  users,
  limit = 4,
  size = "md",
  variant = "spring-tilt",
  className,
  showTooltip = true,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showOverflow, setShowOverflow] = useState(false);

  const visibleUsers = users.slice(0, limit);
  const remainingUsers = users.slice(limit);

  const sizeClasses = {
    sm: "w-7 h-7 text-[10px]",
    md: "w-8 h-8 text-xs",
    lg: "w-10 h-10 text-sm",
  };

  const statusColors = {
    online: "bg-emerald-500",
    busy: "bg-red-500",
    away: "bg-amber-500",
    offline: "bg-neutral-400",
  };

  return (
    <div className={cn("flex items-center -space-x-2.5 relative select-none", className)}>
      {visibleUsers.map((user, index) => {
        const isHovered = hoveredId === user.id;
        const tiltAngle = variant === "spring-tilt" ? (index % 2 === 0 ? -6 : 6) : 0;

        return (
          <div
            key={user.id}
            className="relative"
            onMouseEnter={() => setHoveredId(user.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <motion.div
              initial={false}
              animate={{
                scale: isHovered ? 1.22 : 1,
                rotate: isHovered ? tiltAngle : 0,
                y: isHovered ? -5 : 0,
                zIndex: isHovered ? 40 : index + 1,
              }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 24,
                mass: 0.8,
              }}
              className={cn(
                "relative rounded-full ring-2 ring-white dark:ring-neutral-900 overflow-hidden cursor-pointer flex items-center justify-center font-semibold text-white shadow-xs",
                sizeClasses[size],
                user.color || "bg-gradient-to-tr from-blue-600 to-indigo-500"
              )}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user.initials}</span>
              )}

              {/* Status indicator pip */}
              {user.status && (
                <span
                  className={cn(
                    "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-1.5 ring-white dark:ring-neutral-900",
                    statusColors[user.status]
                  )}
                />
              )}
            </motion.div>

            {/* Rich Hover Tooltip */}
            {showTooltip && (
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 450, damping: 28 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none"
                  >
                    <div className="bg-neutral-900/95 dark:bg-neutral-800/95 text-white backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xl border border-neutral-700/50 dark:border-neutral-700 whitespace-nowrap text-left">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white">
                          {user.name}
                        </span>
                        {user.status && (
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              statusColors[user.status]
                            )}
                          />
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {user.role}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        );
      })}

      {/* Overflow Badge with Popover */}
      {remainingUsers.length > 0 && (
        <div
          className="relative"
          onMouseEnter={() => setShowOverflow(true)}
          onMouseLeave={() => setShowOverflow(false)}
        >
          <motion.button
            whileHover={{ scale: 1.15, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={cn(
              "relative rounded-full ring-2 ring-white dark:ring-neutral-900 bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-mono font-bold flex items-center justify-center cursor-pointer shadow-xs z-10",
              sizeClasses[size]
            )}
          >
            +{remainingUsers.length}
          </motion.button>

          <AnimatePresence>
            {showOverflow && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-neutral-900 rounded-xl p-2 shadow-2xl border border-neutral-200 dark:border-neutral-800 z-50 text-xs"
              >
                <div className="font-mono text-[10px] text-neutral-400 pb-1.5 border-b border-neutral-100 dark:border-neutral-800 mb-1 px-1">
                  Active Dispatch Queue
                </div>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {remainingUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-2 p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      <span
                        className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold shrink-0",
                          u.color || "bg-neutral-600"
                        )}
                      >
                        {u.initials}
                      </span>
                      <div className="truncate min-w-0">
                        <div className="font-medium text-[11px] text-neutral-900 dark:text-neutral-100 truncate">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-neutral-400 truncate">
                          {u.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
