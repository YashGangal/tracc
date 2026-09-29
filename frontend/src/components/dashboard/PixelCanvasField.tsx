import React, { useEffect, useRef } from "react";
import { PixelCanvas, type PixelCanvasOptions } from "../../lib/pixel-canvas";

interface PixelCanvasFieldProps extends PixelCanvasOptions {
  className?: string;
}

/** Full-bleed interactive pixel field (componentry pixel-canvas port). */
export const PixelCanvasField: React.FC<PixelCanvasFieldProps> = ({
  className = "",
  gap = 6,
  speed,
  colors,
  variant,
  ambient = true,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  // Colors array identity changes per render — key on contents instead.
  const colorKey = (colors || []).join(",");

  useEffect(() => {
    if (!ref.current) return;
    const field = new PixelCanvas(ref.current, { gap, speed, colors, variant, ambient });
    return () => field.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gap, speed, variant, ambient, colorKey]);

  return <div ref={ref} aria-hidden className={`absolute inset-0 overflow-hidden ${className}`} />;
};
