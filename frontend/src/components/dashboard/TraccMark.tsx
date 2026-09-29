import React, { useState } from "react";

interface TraccMarkProps {
  size?: number;
  className?: string;
  /** "auto" follows the dashboard .dark theme; login passes "dark" explicitly. */
  theme?: "auto" | "dark" | "light";
}

/** Tracc "T" mark — white-T version on dark backgrounds, ink-T on light. */
export const TraccMark: React.FC<TraccMarkProps> = ({ size = 28, className = "", theme = "auto" }) => {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={`grid place-items-center rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-extrabold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.55 }}
        aria-label="Tracc"
      >
        T
      </span>
    );
  }
  const style = { width: size, height: size };
  if (theme !== "auto") {
    return (
      <img
        src={theme === "dark" ? "/tracc-mark-dark.svg" : "/tracc-mark-light.svg"}
        alt="Tracc"
        width={size}
        height={size}
        style={style}
        className={`rounded-lg object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className={`inline-block ${className}`} style={style} aria-label="Tracc" role="img">
      <img
        src="/tracc-mark-light.svg"
        alt=""
        width={size}
        height={size}
        style={style}
        className="rounded-lg object-cover dark:hidden"
        onError={() => setFailed(true)}
      />
      <img
        src="/tracc-mark-dark.svg"
        alt=""
        width={size}
        height={size}
        style={style}
        className="rounded-lg object-cover hidden dark:block"
        onError={() => setFailed(true)}
      />
    </span>
  );
};
