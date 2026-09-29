"use client";

import React, { useState, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { cn } from "../../lib/utils";

export interface LinkedinCardProps {
  username: string;
  name?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  headline?: string;
  connections?: number | string;
  location?: string;
  text?: React.ReactNode;
  linkText?: React.ReactNode;
  href?: string;
  enableLinkTilt?: boolean;
  linkTiltMaxRotate?: number;
  enableCardTilt?: boolean;
  cardTiltMaxRotate?: number;
  align?: "left" | "center" | "right";
  className?: string;
  popoverClassName?: string;
  linkClassName?: string;
  labelClassName?: string;
}

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={cn("fill-current", className)}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

export const LinkedinCard: React.FC<LinkedinCardProps> = ({
  username,
  name = "LinkedIn User",
  avatarUrl = "https://github.com/YashGangal.png",
  bannerUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80",
  headline = "Software Engineer & Architect",
  connections = "500+",
  location = "Bengaluru, India",
  text = "Connect on",
  linkText = "LinkedIn",
  href,
  enableLinkTilt = true,
  linkTiltMaxRotate = 5,
  enableCardTilt = true,
  cardTiltMaxRotate = 5,
  align = "center",
  className,
  popoverClassName,
  linkClassName,
  labelClassName,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const profileUrl = href || `https://linkedin.com/in/${username}`;
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
              transition: { duration: 0.15, ease: "easeIn" },
            },
            visible: {
              opacity: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              pointerEvents: "auto",
              transformOrigin: "bottom center",
              transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className={cn(
            "absolute bottom-full z-50 mb-3 w-80 rounded-2xl border border-dashed border-neutral-300 bg-white/95 p-4 shadow-2xl backdrop-blur-md transition-colors after:absolute after:top-full after:left-0 after:h-4 after:w-full dark:border-dashed dark:border-neutral-800 dark:bg-neutral-950/95",
            alignClass,
            popoverClassName
          )}
        >
          <div className="relative -mx-4 -mt-4 h-20 overflow-hidden rounded-t-2xl bg-neutral-200 dark:bg-neutral-800">
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt="Banner"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="pb-2">
            <div className="relative flex justify-between">
              <div className="-mt-10 h-18 w-18 rounded-full border-3 border-white bg-white dark:border-neutral-950 dark:bg-neutral-950 shadow-sm overflow-hidden">
                <img
                  src={avatarUrl}
                  alt={name}
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
              <div className="mt-2 text-[#0A66C2]">
                <LinkedinIcon className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-2 text-left">
              <h3 className="text-base leading-tight font-semibold text-neutral-900 dark:text-white">
                {name}
              </h3>
              <p className="mt-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">
                {headline}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-500">
                {location}
              </p>
              <p className="mt-2 text-[11px] font-semibold text-neutral-900 dark:text-neutral-300">
                {connections} connections
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LinkedinCard;
