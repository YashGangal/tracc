import React, { useEffect, useRef, useState } from "react";
import { PixelCanvas, type PixelCanvasOptions } from "../../lib/pixel-canvas";
import { usePrefersReducedMotion } from "../ui/dotmatrix-hooks";

interface PixelCanvasFieldProps extends PixelCanvasOptions {
  className?: string;
}

/** Full-bleed interactive pixel field (componentry pixel-canvas port).
 * Skipped entirely on reduced motion, data-saver, or small screens — the
 * page stays a flat backdrop instead of burning GPU for decoration. */
export const PixelCanvasField: React.FC<PixelCanvasFieldProps> = ({
  className = "",
  gap = 6,
  speed,
  colors,
  variant,
  ambient = true,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = usePrefersReducedMotion();
  const [cheapMode] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (conn?.saveData) return true;
      if (window.matchMedia?.("(max-width: 1023px)").matches) return true;
    } catch {
      /* default to full field */
    }
    return false;
  });
  const enabled = !reduceMotion && !cheapMode;
  // Colors array identity changes per render — key on contents instead.
  const colorKey = (colors || []).join(",");

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const field = new PixelCanvas(ref.current, { gap, speed, colors, variant, ambient });
    return () => field.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gap, speed, variant, ambient, colorKey]);

  return <div ref={ref} aria-hidden className={`absolute inset-0 overflow-hidden ${className}`} />;
};
