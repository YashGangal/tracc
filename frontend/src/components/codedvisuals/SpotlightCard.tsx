import React, { useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  borderColor?: string;
}

/**
 * SpotlightCard inspired by Great UI (great-ui.com)
 * Dynamically tracks cursor movement to project an ambient radial spotlight
 * highlight on the card surface and perimeter border.
 */
export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className,
  spotlightColor = "rgba(59, 130, 246, 0.14)",
  borderColor = "rgba(59, 130, 246, 0.35)",
  ...props
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleFocus = () => {
    setIsFocused(true);
    setOpacity(1);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  const handleMouseEnter = () => {
    setOpacity(1);
  };

  const handleMouseLeave = () => {
    setOpacity(0);
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "relative rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs overflow-hidden transition-colors",
        className
      )}
      {...props}
    >
      {/* Background glow radial gradient */}
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      {/* Border spotlight highlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-xl border border-transparent transition-opacity duration-300"
        style={{
          opacity,
          WebkitMask: `radial-gradient(220px circle at ${position.x}px ${position.y}px, black 35%, transparent 70%)`,
          mask: `radial-gradient(220px circle at ${position.x}px ${position.y}px, black 35%, transparent 70%)`,
          borderColor: borderColor,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
};
