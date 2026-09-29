export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.14,
    standard: 0.20,
    emphasis: 0.28,
    panel: 0.36,
    chart: 0.65,
  },
  ease: {
    enter: [0.22, 1, 0.36, 1] as [number, number, number, number],
    exit: [0.4, 0, 1, 1] as [number, number, number, number],
    standard: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
  distance: {
    micro: 4,
    small: 8,
    standard: 12,
    panel: 24,
  },
} as const;

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: motionTokens.duration.fast, ease: motionTokens.ease.standard },
};

export const slideUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: { duration: motionTokens.duration.emphasis, ease: motionTokens.ease.enter },
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.duration.standard, ease: motionTokens.ease.enter },
  },
};
