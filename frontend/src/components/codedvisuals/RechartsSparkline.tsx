import React from "react";
import { ResponsiveContainer, AreaChart, Area, Tooltip, YAxis } from "recharts";

export interface SparklinePoint {
  period: string;
  value: number;
}

interface RechartsSparklineProps {
  data: SparklinePoint[];
  color?: string;
  gradientId: string;
  formatter?: (val: number) => string;
  height?: number;
  trend?: "up" | "down" | "neutral";
}

export const RechartsSparkline: React.FC<RechartsSparklineProps> = ({
  data,
  color,
  gradientId,
  formatter = (v) => v.toLocaleString(),
  height = 36,
  trend = "up",
}) => {
  if (!data || data.length === 0) return null;

  const strokeColor =
    color ||
    (trend === "up"
      ? "#10b981"
      : trend === "down"
      ? "#f87171"
      : "#3b82f6");

  const minVal = Math.min(...data.map((d) => d.value));
  const maxVal = Math.max(...data.map((d) => d.value));
  const padding = (maxVal - minVal) * 0.15 || 1;

  return (
    <div className="w-full relative min-w-0" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={80} minHeight={height}>
        <AreaChart
          data={data}
          margin={{ top: 2, right: 1, left: 1, bottom: 2 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <YAxis
            domain={[minVal - padding, maxVal + padding]}
            hide
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const item = payload[0].payload as SparklinePoint;
                return (
                  <div className="bg-neutral-900/95 dark:bg-neutral-950/95 text-white border border-neutral-800 rounded px-2 py-1 shadow-lg text-[10px] font-mono pointer-events-none z-50">
                    <div className="text-neutral-400 text-[9px]">{item.period}</div>
                    <div className="font-semibold text-white">
                      {formatter(item.value)}
                    </div>
                  </div>
                );
              }
              return null;
            }}
            cursor={{
              stroke: strokeColor,
              strokeWidth: 1,
              strokeDasharray: "2 2",
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={strokeColor}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{
              r: 3,
              fill: strokeColor,
              stroke: "#ffffff",
              strokeWidth: 1.5,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
