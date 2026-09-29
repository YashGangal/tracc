import React, { useEffect, useState } from "react";
import { motion } from "motion/react";

interface AnimatedNumberProps {
  value: number;
  formatter?: (val: number) => string;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  formatter = (v) => v.toLocaleString(),
  className = "",
}) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  return (
    <motion.span
      key={value}
      initial={{ opacity: 0.65, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={`tabular-nums font-mono ${className}`}
    >
      {formatter(displayValue)}
    </motion.span>
  );
};
