import React from "react";
import { motion } from "motion/react";
import { AlertCircle, AlertTriangle, CheckCircle, Cpu, Truck } from "lucide-react";
import { ActivityEvent } from "../../lib/types";
import { cn } from "../../lib/utils";

interface ActivityFeedProps {
  events: ActivityEvent[];
  className?: string;
  onSelectEvent?: (event: ActivityEvent) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  events,
  className,
  onSelectEvent,
}) => {
  const getIcon = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "risk":
        return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
      case "delay":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      case "delivery":
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case "automation":
        return <Cpu className="w-3.5 h-3.5 text-blue-500" />;
      case "carrier":
        return <Truck className="w-3.5 h-3.5 text-purple-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-neutral-400" />;
    }
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      {events.map((ev, index) => (
        <motion.div
          key={ev.id}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.04 }}
          onClick={() => onSelectEvent?.(ev)}
          className="flex items-start gap-2.5 p-2 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer text-xs group"
        >
          <div className="mt-0.5 shrink-0">{getIcon(ev.type)}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate group-hover:text-blue-500 transition-colors">
                {ev.title}
              </span>
              <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-2">
                {ev.time}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1 mt-0.5">
              {ev.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
