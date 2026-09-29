import React from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils";

interface AnimatedLinkProps extends Omit<HTMLMotionProps<"a">, "children"> {
  children: React.ReactNode;
  variant?: "underline-sweep" | "magnetic-arrow" | "pill-glow";
  external?: boolean;
}

/**
 * AnimatedLink inspired by Great UI (great-ui.com)
 * Offers fluid hover physics, sweep underlines, and magnetic icon movement.
 */
export const AnimatedLink: React.FC<AnimatedLinkProps> = ({
  children,
  variant = "magnetic-arrow",
  external = false,
  className,
  onClick,
  ...props
}) => {
  const Icon = external ? ArrowUpRight : ArrowRight;

  return (
    <motion.a
      whileHover="hover"
      initial="initial"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-1 font-medium cursor-pointer text-blue-600 dark:text-blue-400 text-xs transition-colors",
        className
      )}
      {...props}
    >
      <span className="relative">
        {children}
        {variant === "underline-sweep" && (
          <motion.span
            className="absolute left-0 bottom-0 w-full h-[1.5px] bg-blue-500 origin-left"
            variants={{
              initial: { scaleX: 0 },
              hover: { scaleX: 1 },
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        )}
      </span>

      <motion.span
        variants={{
          initial: { x: 0, y: 0 },
          hover: { x: external ? 2 : 4, y: external ? -2 : 0 },
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <Icon className="w-3.5 h-3.5" />
      </motion.span>
    </motion.a>
  );
};
