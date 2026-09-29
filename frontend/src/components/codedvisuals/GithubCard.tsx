"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "../../lib/utils";

export interface GithubCardProps {
  username: string;
  name?: string;
  avatarUrl?: string;
  year?: number | string;
  text?: React.ReactNode;
  linkText?: React.ReactNode;
  href?: string;
  themeScheme?: "monochrome" | "green" | "blue" | "purple";
  calendarTheme?: {
    light: string[];
    dark: string[];
  };
  contributionsData?: { date: string; count: number; level: number }[];
  totalContributions?: number;
  enableLinkTilt?: boolean;
  linkTiltMaxRotate?: number;
  enableCardTilt?: boolean;
  cardTiltMaxRotate?: number;
  align?: "left" | "center" | "right";
  isDark?: boolean;
  className?: string;
  popoverClassName?: string;
  linkClassName?: string;
  labelClassName?: string;
}

const colorSchemes = {
  monochrome: {
    light: ["#f5f5f5", "#d4d4d4", "#a3a3a3", "#737373", "#404040"],
    dark: ["#262626", "#404040", "#737373", "#a3a3a3", "#d4d4d4"],
  },
  green: {
    light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
    dark: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  },
  blue: {
    light: ["#f0f9ff", "#bae6fd", "#38bdf8", "#0284c7", "#0369a1"],
    dark: ["#172554", "#1e3a8a", "#1d4ed8", "#3b82f6", "#60a5fa"],
  },
  purple: {
    light: ["#faf5ff", "#e9d5ff", "#c084fc", "#9333ea", "#6b21a8"],
    dark: ["#2e1065", "#3b0764", "#581c87", "#7e22ce", "#a855f7"],
  },
};

const generateInitialContributions = (seedString: string = "github") => {
  const data = [];
  const today = new Date();
  let hash = 0;
  for (let c = 0; c < seedString.length; c++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(c);
    hash |= 0;
  }
  for (let i = 118; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    // Pseudo-random pattern for baseline heatmap display
    const pseudo = Math.abs(Math.sin(hash + i * 13));
    const level = pseudo > 0.45 ? (pseudo > 0.85 ? 4 : pseudo > 0.7 ? 3 : pseudo > 0.55 ? 2 : 1) : 0;
    const count = level === 0 ? 0 : Math.floor(pseudo * 8) + 1;
    data.push({
      date: date.toISOString().split("T")[0],
      count,
      level,
    });
  }
  return data;
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const GithubCard: React.FC<GithubCardProps> = ({
  username,
  name = "GitHub User",
  avatarUrl,
  year = 2026,
  text = "Follow me on",
  linkText = "GitHub",
  href,
  themeScheme = "green",
  calendarTheme,
  contributionsData,
  totalContributions,
  enableLinkTilt = true,
  linkTiltMaxRotate = 5,
  enableCardTilt = true,
  cardTiltMaxRotate = 5,
  align = "center",
  isDark: propIsDark,
  className,
  popoverClassName,
  linkClassName,
  labelClassName,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return true;
  });

  const [profile, setProfile] = useState<{ name: string; avatarUrl: string }>({
    name,
    avatarUrl: avatarUrl || `https://github.com/${username}.png`,
  });

  const [contributionsList, setContributionsList] = useState<
    { date: string; count: number; level: number }[]
  >(() => generateInitialContributions(username));

  // Sync theme changes
  useEffect(() => {
    setMounted(true);

    if (propIsDark !== undefined) {
      setDarkMode(propIsDark);
      return;
    }

    const checkDark = () => {
      setDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, [propIsDark]);

  useEffect(() => {
    // Fetch GitHub Profile
    fetch(`https://api.github.com/users/${username}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        setProfile({
          name: data.name || data.login || name,
          avatarUrl:
            data.avatar_url ||
            avatarUrl ||
            `https://github.com/${username}.png`,
        });
      })
      .catch(() => {});

    if (contributionsData) {
      setContributionsList(contributionsData);
      return;
    }

    interface APIContribution {
      date: string;
      count: number;
      level: number;
    }

    interface APIData {
      contributions: APIContribution[];
    }

    fetch(`https://github-contributions-api.jogruber.de/v4/${username}`)
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data: APIData) => {
        if (data.contributions && data.contributions.length > 0) {
          const today = new Date();
          const pastContributions = data.contributions.filter(
            (d) => new Date(d.date) <= today
          );
          const sorted = pastContributions.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          setContributionsList(sorted.slice(-119));
        }
      })
      .catch(() => {});
  }, [username, name, avatarUrl, contributionsData]);

  const isDark = propIsDark !== undefined ? propIsDark : darkMode;
  const activeTheme = calendarTheme || colorSchemes[themeScheme];

  const contributions = useMemo(() => {
    if (!mounted) {
      return Array.from({ length: 119 }, () => ({
        date: "",
        count: 0,
        level: 0,
      }));
    }
    return contributionsList;
  }, [mounted, contributionsList]);

  const linkRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [hoverType, setHoverType] = useState<"none" | "link" | "card">("none");

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 20 });

  const rotateX = useTransform(mouseYSpring, (val) => {
    const maxRotate =
      hoverType === "link" ? linkTiltMaxRotate : cardTiltMaxRotate;
    const pct = (val + 20) / 40;
    return maxRotate - pct * (2 * maxRotate);
  });

  const rotateY = useTransform(mouseXSpring, (val) => {
    const maxRotate =
      hoverType === "link" ? linkTiltMaxRotate : cardTiltMaxRotate;
    const pct = (val + 20) / 40;
    return -maxRotate + pct * (2 * maxRotate);
  });

  const handleLinkMouseMove = (e: React.MouseEvent) => {
    if (!enableLinkTilt || !linkRef.current) {
      x.set(0);
      y.set(0);
      return;
    }
    const rect = linkRef.current.getBoundingClientRect();
    const nx =
      ((e.clientX - rect.left - rect.width / 2) / (rect.width / 2)) * 20;
    const ny =
      ((e.clientY - rect.top - rect.height / 2) / (rect.height / 2)) * 20;
    x.set(nx);
    y.set(ny);
  };

  const handleCardMouseMove = (e: React.MouseEvent) => {
    if (!enableCardTilt || !cardRef.current) {
      x.set(0);
      y.set(0);
      return;
    }
    const rect = cardRef.current.getBoundingClientRect();
    const nx =
      ((e.clientX - rect.left - rect.width / 2) / (rect.width / 2)) * 20;
    const ny =
      ((e.clientY - rect.top - rect.height / 2) / (rect.height / 2)) * 20;
    x.set(nx);
    y.set(ny);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setHoverType("none");
    x.set(0);
    y.set(0);
  };

  const calculatedTotalCommits = useMemo(() => {
    if (totalContributions !== undefined) return totalContributions;
    return contributions.reduce((acc, curr) => acc + curr.count, 0);
  }, [contributions, totalContributions]);

  const profileUrl = href || `https://github.com/${username}`;

  const popoverStyle = {
    x: mouseXSpring,
    rotateX,
    rotateY,
    transformStyle: "preserve-3d" as const,
  };

  const alignClass =
    align === "left"
      ? "left-0"
      : align === "right"
      ? "right-0"
      : "left-1/2 -translate-x-1/2";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {text && (
        <span
          className={cn(
            "text-xs font-medium text-neutral-900/70 transition-colors dark:text-neutral-100/70",
            labelClassName
          )}
        >
          {text}
        </span>
      )}
      <div
        className="relative flex w-max flex-col items-center [perspective:1000px]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={linkRef}
          onMouseEnter={() => {
            setHoverType("link");
            if (!enableLinkTilt) {
              x.set(0);
              y.set(0);
            }
          }}
          onMouseMove={handleLinkMouseMove}
          className="cursor-pointer"
        >
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1"
          >
            <span
              className={cn(
                "text-xs font-semibold text-neutral-900/80 underline underline-offset-4 transition-all duration-300 hover:text-neutral-900 dark:text-neutral-100/80 dark:hover:text-white",
                linkClassName
              )}
            >
              {linkText}
            </span>
          </a>
        </div>

        <motion.div
          ref={cardRef}
          onMouseEnter={() => {
            setHoverType("card");
            if (!enableCardTilt) {
              x.set(0);
              y.set(0);
            }
          }}
          onMouseMove={handleCardMouseMove}
          initial="hidden"
          style={popoverStyle}
          animate={isHovered ? "visible" : "hidden"}
          variants={{
            hidden: {
              opacity: 0,
              y: 6,
              scale: 0.98,
              filter: "blur(2px)",
              pointerEvents: "none",
              transformOrigin: "bottom center",
              transition: {
                duration: 0.15,
                ease: "easeIn",
              },
            },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              pointerEvents: "auto",
              transformOrigin: "bottom center",
              transition: {
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1],
              },
            },
          }}
          className={cn(
            "absolute bottom-full z-50 mb-3 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-dashed border-neutral-300 bg-white/95 p-5 shadow-2xl backdrop-blur-md transition-colors after:absolute after:top-full after:left-0 after:h-4 after:w-full dark:border-neutral-800 dark:bg-neutral-950/95",
            alignClass,
            popoverClassName
          )}
        >
          <div className="mb-3.5 flex items-center gap-3.5">
            <img
              src={profile.avatarUrl}
              alt={`${profile.name}'s Avatar`}
              className="h-11 w-11 rounded-full border border-neutral-200 object-cover shadow-sm dark:border-neutral-700 dark:shadow-none"
            />
            <div className="flex flex-col text-left">
              <span className="text-sm font-semibold text-neutral-900 transition-colors dark:text-white">
                {profile.name}
              </span>
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-500 transition-colors hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                @{username}
              </a>
            </div>
          </div>

          <div className="mx-auto grid w-max grid-flow-col grid-rows-7 gap-1 select-none">
            {contributions.map((day, index) => {
              const color = isDark
                ? activeTheme.dark[day.level]
                : activeTheme.light[day.level];
              return (
                <div key={day.date || index} className="group/cell relative">
                  <div
                    style={{ backgroundColor: color }}
                    className="h-2.5 w-2.5 cursor-pointer rounded-[2px] transition-all duration-200 hover:z-10 hover:scale-135"
                  />
                  {mounted && day.date && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-2 hidden -translate-x-1/2 rounded bg-neutral-900/95 px-2 py-1 text-[10px] font-semibold whitespace-nowrap text-white shadow-md group-hover/cell:block dark:bg-neutral-100/95 dark:text-neutral-900">
                      <span>{day.count} commits</span> on {formatDate(day.date)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <span className="mt-3 block text-left font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            {mounted
              ? `${calculatedTotalCommits.toLocaleString()} contributions in ${year}`
              : "... contributions"}
          </span>
        </motion.div>
      </div>
    </div>
  );
};

export default GithubCard;
