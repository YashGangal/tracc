// PixelCanvas — TypeScript port of the vanilla componentry.dev pixel-canvas
// (see LOGINPAGE package js/pixel-canvas.js for the reference source).
// A pixel grid that lights up under the pointer and decays with color
// interpolation. Self-parking when idle, DPR self-healing, reduced-motion
// opt-out, pause on hidden tabs.

export interface PixelCanvasOptions {
  gap?: number;
  speed?: number;
  colors?: string[];
  variant?: "default" | "glow" | "trail";
  ambient?: boolean;
}

interface Pixel {
  x: number;
  y: number;
  size: number;
  intensity: number;
  targetIntensity: number;
  colorPhase: number;
  decayRate: number;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : null;
}

const IDLE_LIMIT = 90;

export class PixelCanvas {
  private container: HTMLElement;
  private gap: number;
  private speed: number;
  private colors: string[];
  private variant: "default" | "glow" | "trail";
  private ambient: boolean;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pixels: Pixel[][] = [];
  private cols = 0;
  private rows = 0;
  /** Cached container rect (updated on init/resize only — never per frame). */
  private bounds = { width: 0, height: 0 };
  private mouse = { x: -1000, y: -1000 };
  private running = false;
  private raf = 0;
  private lastTime = 0;
  private lastDrawnTs = 0;
  private idleFrames = 0;
  private blipTimer = 0;
  private reducedMotion: boolean;
  private colorAt: (i1: number, i2: number, t: number) => string;
  private destroyed = false;

  constructor(container: HTMLElement, opts: PixelCanvasOptions = {}) {
    this.container = container;
    this.gap = typeof opts.gap === "number" ? opts.gap : 6;
    this.speed = typeof opts.speed === "number" ? opts.speed : 0.02;
    this.colors = opts.colors || ["#3b82f6", "#22d3ee", "#22c55e"];
    this.variant = opts.variant || "default";
    this.ambient = !!opts.ambient;

    this.canvas = document.createElement("canvas");
    this.canvas.className = "pixel-canvas-surface";
    this.canvas.setAttribute("aria-hidden", "true");
    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext("2d", { alpha: true });
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;

    this.reducedMotion =
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const rgb = this.colors.map((c) => hexToRgb(c) || { r: 255, g: 255, b: 255 });
    this.colorAt = (i1, i2, t) => {
      const c1 = rgb[Math.max(0, Math.min(rgb.length - 1, i1))];
      const c2 = rgb[Math.max(0, Math.min(rgb.length - 1, i2))];
      const r = Math.round(c1.r + (c2.r - c1.r) * t);
      const g = Math.round(c1.g + (c2.g - c1.g) * t);
      const b = Math.round(c1.b + (c2.b - c1.b) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    document.addEventListener("pointerleave", this.onLeave);
    window.addEventListener("touchmove", this.onTouch, { passive: true });
    window.addEventListener("touchend", this.onTouchEnd, { passive: true });
    document.addEventListener("visibilitychange", this.onVisibility);

    this.initPixels();
    if (!this.reducedMotion) this.start();
  }

  private debounceTimer = 0;
  private onResize = () => {
    window.clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => this.initPixels(), 120);
  };
  private onMove = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.start();
  };
  private onLeave = () => {
    this.mouse.x = -1000;
    this.mouse.y = -1000;
  };
  private onTouch = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = t.clientX - rect.left;
    this.mouse.y = t.clientY - rect.top;
    this.start();
  };
  private onTouchEnd = () => this.onLeave();
  private onVisibility = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private initPixels() {
    const rect = this.container.getBoundingClientRect();
    this.bounds = { width: rect.width, height: rect.height };
    // Cap DPR: visual difference above 2x is nil, cost is quadratic.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const size = Math.max(this.gap, 4);
    const cols = Math.ceil(rect.width / size) || 1;
    const rows = Math.ceil(rect.height / size) || 1;
    const next: Pixel[][] = [];
    for (let i = 0; i < cols; i++) {
      const row: Pixel[] = [];
      for (let j = 0; j < rows; j++) {
        const existing = this.pixels[i]?.[j];
        row.push({
          x: i * size,
          y: j * size,
          size: size - 1,
          intensity: existing ? existing.intensity : 0,
          targetIntensity: 0,
          colorPhase: Math.random(),
          decayRate: 0,
        });
      }
      next.push(row);
    }
    this.pixels = next;
    this.cols = cols;
    this.rows = rows;
  }

  private colorFromIntensity(intensity: number, phase: number): string {
    const n = this.colors.length;
    if (n === 0) return "#ffffff";
    if (n === 1) return this.colors[0];
    const t = (phase + intensity) % 1;
    const index = Math.floor(t * (n - 1));
    const nextIndex = Math.min(index + 1, n - 1);
    const localT = (t * (n - 1)) % 1;
    return this.colorAt(index, nextIndex, localT);
  }

  private frame = (timestamp: number) => {
    if (!this.running || this.destroyed) return;

    // Decay frames run at half rate when the pointer is absent.
    if (this.mouse.x === -1000 && timestamp - this.lastDrawnTs < 33) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.lastDrawnTs = timestamp;

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    const { width, height } = this.bounds;

    // Self-heal on device pixel ratio drift: resizing the buffer clears it,
    // so re-init the grid rather than drawing into a stale surface.
    const expectW = Math.max(1, Math.round(width * Math.min(window.devicePixelRatio || 1, 2)));
    if (this.canvas.width !== expectW) this.initPixels();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const mouseX = this.mouse.x;
    const mouseY = this.mouse.y;
    const radius = this.variant === "glow" ? 120 : 80;
    const glowPasses = this.variant === "glow" ? 2 : 1;
    let maxIntensity = 0;

    for (let i = 0; i < this.cols; i++) {
      const col = this.pixels[i];
      if (!col) continue;
      for (let j = 0; j < this.rows; j++) {
        const pixel = col[j];
        if (!pixel) continue;

        const dx = mouseX - (pixel.x + pixel.size / 2);
        const dy = mouseY - (pixel.y + pixel.size / 2);
        if (dx > radius || dx < -radius || dy > radius || dy < -radius) {
          pixel.targetIntensity = 0;
        } else {
          const distance = Math.sqrt(dx * dx + dy * dy);
          pixel.targetIntensity = distance < radius ? Math.pow(1 - distance / radius, 1.5) : 0;
        }

        const lerp = pixel.targetIntensity > pixel.intensity ? 0.3 : pixel.decayRate || this.speed;
        pixel.intensity += (pixel.targetIntensity - pixel.intensity) * lerp;
        if (pixel.targetIntensity > 0 && pixel.decayRate) pixel.decayRate = 0;
        pixel.colorPhase = (pixel.colorPhase + 0.001 * (deltaTime / 16)) % 1;

        if (pixel.intensity > maxIntensity) maxIntensity = pixel.intensity;
        if (pixel.intensity > 0.01) {
          const color = this.colorFromIntensity(pixel.intensity, pixel.colorPhase);
          if (this.variant === "glow" && pixel.intensity > 0.2) {
            for (let g = glowPasses; g > 0; g--) {
              const glowSize = pixel.size + g * 4;
              const glowOffset = (glowSize - pixel.size) / 2;
              ctx.globalAlpha = (pixel.intensity * 0.15) / g;
              ctx.fillStyle = color;
              ctx.fillRect(pixel.x - glowOffset, pixel.y - glowOffset, glowSize, glowSize);
            }
          }
          ctx.globalAlpha = pixel.intensity * 0.9;
          ctx.fillStyle = color;
          ctx.fillRect(pixel.x, pixel.y, pixel.size, pixel.size);
        }
      }
    }

    ctx.globalAlpha = 1;

    if (maxIntensity < 0.012) {
      this.idleFrames++;
      if (this.idleFrames > IDLE_LIMIT) {
        this.running = false;
        ctx.clearRect(0, 0, width, height);
        if (this.ambient) this.scheduleBlip();
        return;
      }
    } else {
      this.idleFrames = 0;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private scheduleBlip() {
    window.clearTimeout(this.blipTimer);
    this.blipTimer = window.setTimeout(() => {
      if (this.reducedMotion || this.destroyed || !this.pixels.length) return;
      const bi = 1 + Math.floor(Math.random() * Math.max(1, this.cols - 2));
      const bj = 1 + Math.floor(Math.random() * Math.max(1, this.rows - 2));
      const cluster = [
        [0, 0, 0.9],
        [1, 0, 0.45],
        [-1, 0, 0.45],
        [0, 1, 0.45],
        [0, -1, 0.45],
      ];
      for (const [di, dj, v] of cluster) {
        const py = this.pixels[bi + di]?.[bj + dj];
        if (py) {
          py.intensity = v;
          py.decayRate = 0.05;
        }
      }
      this.lastTime = performance.now();
      this.start();
    }, 2000 + Math.random() * 1200);
  }

  private start() {
    if (this.running || this.reducedMotion || this.destroyed) return;
    this.running = true;
    this.idleFrames = 0;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    window.clearTimeout(this.blipTimer);
    window.clearTimeout(this.debounceTimer);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("pointermove", this.onMove);
    document.removeEventListener("pointerleave", this.onLeave);
    window.removeEventListener("touchmove", this.onTouch);
    window.removeEventListener("touchend", this.onTouchEnd);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.remove();
  }
}
