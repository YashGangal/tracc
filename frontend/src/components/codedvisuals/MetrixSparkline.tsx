import React from "react";
import { motion } from "motion/react";

interface MetrixSparklineProps {
  data: number[];
  color?: string;
  trend?: "up" | "down" | "neutral";
  width?: number;
  height?: number;
  animated?: boolean;
}

export const MetrixSparkline: React.FC<MetrixSparklineProps> = ({
  data,
  trend = "neutral",
  width = 96,
  height = 32,
  animated = true,
}) => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 3;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const fillD = `${pathD} L ${width - padding},${height} L ${padding},${height} Z`;

  const strokeColor =
    trend === "up"
      ? "#10b981"
      : trend === "down"
      ? "#f87171"
      : "#3b82f6";

  const fillColor =
    trend === "up"
      ? "rgba(16, 185, 129, 0.12)"
      : trend === "down"
      ? "rgba(248, 113, 113, 0.12)"
      : "rgba(59, 130, 246, 0.12)";

  return (
    <div className="relative inline-flex items-center">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <path d={fillD} fill={fillColor} />
        {animated ? (
          <motion.path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          />
        ) : (
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* End dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].split(",")[0]}
            cy={points[points.length - 1].split(",")[1]}
            r={2.5}
            fill={strokeColor}
          />
        )}
      </svg>
    </div>
  );
};
