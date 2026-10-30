"use client";

import React, { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  mode?: "light" | "dark";
  variant?: "landing" | "dashboard";
  className?: string;
}

function GocAnimatedLogoSpinner({
  theme = "dark",
}: {
  theme?: "light" | "dark";
}) {
  const isLight = theme === "light";
  const barFill = isLight ? "#000000" : "#FFFFFF";
  const gradientId = `gocOrangeGrad-${useId().replace(/:/g, "")}`;

  return (
    <div className="relative flex items-center justify-center p-2">
      {!isLight ? (
        <div className="absolute h-24 w-24 rounded-full bg-orange-500/25 blur-2xl transition-all duration-700 animate-pulse" />
      ) : null}

      <style>{`
        @keyframes gocBarTop {
          0% { transform: scaleX(0); opacity: 0; transform-origin: left center; }
          15%, 80% { transform: scaleX(1); opacity: 1; transform-origin: left center; }
          95%, 100% { transform: scaleX(0); opacity: 0; transform-origin: right center; }
        }

        @keyframes gocBarLeft {
          0%, 10% { transform: scaleY(0); opacity: 0; transform-origin: top center; }
          25%, 80% { transform: scaleY(1); opacity: 1; transform-origin: top center; }
          95%, 100% { transform: scaleY(0); opacity: 0; transform-origin: bottom center; }
        }

        @keyframes gocBarBottom {
          0%, 20% { transform: scaleX(0); opacity: 0; transform-origin: left center; }
          35%, 80% { transform: scaleX(1); opacity: 1; transform-origin: left center; }
          95%, 100% { transform: scaleX(0); opacity: 0; transform-origin: right center; }
        }

        @keyframes gocBarRight {
          0%, 30% { transform: scaleY(0); opacity: 0; transform-origin: bottom center; }
          45%, 80% { transform: scaleY(1); opacity: 1; transform-origin: bottom center; }
          95%, 100% { transform: scaleY(0); opacity: 0; transform-origin: top center; }
        }

        @keyframes gocPlayArrow {
          0%, 35% { transform: scale(0.4); opacity: 0; transform-origin: 14.9px 14.25px; }
          50%, 80% { transform: scale(1); opacity: 1; transform-origin: 14.9px 14.25px; }
          95%, 100% { transform: scale(0.4); opacity: 0; transform-origin: 14.9px 14.25px; }
        }

        .goc-bar-top { animation: gocBarTop 1.8s ease-in-out infinite; }
        .goc-bar-left { animation: gocBarLeft 1.8s ease-in-out infinite; }
        .goc-bar-bottom { animation: gocBarBottom 1.8s ease-in-out infinite; }
        .goc-bar-right { animation: gocBarRight 1.8s ease-in-out infinite; }
        .goc-play-arrow { animation: gocPlayArrow 1.8s ease-in-out infinite; }
      `}</style>

      {/* SVG Vector GOC Logo */}
      <svg
        viewBox="0 0 31 28.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "relative z-10 h-16 w-16 sm:h-20 sm:w-20",
          !isLight && "drop-shadow-[0_0_15px_rgba(255,106,26,0.6)]",
        )}
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#FDC155" />
            <stop offset="100%" stopColor="#FF652D" />
          </linearGradient>
        </defs>

        {/* Left Bar */}
        <rect
          x="0"
          y="5.5"
          width="5.5"
          height="17.5"
          rx="0"
          fill={barFill}
          className="goc-bar-left"
        />

        {/* Top Bar */}
        <path
          d="M 5.5 0 h 18.5 a 2 2 0 0 1 2 2 v 1.5 a 2 2 0 0 1 -2 2 H 5.5 Z"
          fill={barFill}
          className="goc-bar-top"
        />

        {/* Bottom Bar */}
        <rect
          x="5.5"
          y="23"
          width="20.5"
          height="5.5"
          rx="0"
          fill={barFill}
          className="goc-bar-bottom"
        />

        {/* Right Short Connector Bar */}
        <path
          d="M 27 15.5 h 1.5 a 2 2 0 0 1 2 2 v 5.5 h -5.5 v -5.5 a 2 2 0 0 1 2 -2 z"
          fill={barFill}
          className="goc-bar-right"
        />

        {/* Center Orange Play Arrow */}
        <path
          d="M 10.5 9.5 L 19.5 14.25 L 10.5 19 Z"
          fill={`url(#${gradientId})`}
          className="goc-play-arrow"
        />
      </svg>
    </div>
  );
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  mode = "light",
  className,
}) => {
  const [theme, setTheme] = useState<"light" | "dark">(mode);

  // Landing and dashboard share the same mark. Bars follow light/dark.
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      const currentMode = modeElement?.getAttribute("data-mode");
      if (currentMode === "light" || currentMode === "dark") {
        setTheme(currentMode);
        return;
      }
      setTheme(mode);
    };

    checkMode();

    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, [mode]);

  return (
    <div className={cn("flex items-center justify-center min-h-[140px]", className)}>
      <GocAnimatedLogoSpinner theme={theme} />
    </div>
  );
};

export default LoadingSpinner;

// Page-level loading component
export function PageLoadingSpinner({
  mode = "light",
  variant,
  className,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center min-h-[200px]", className)}>
      <LoadingSpinner mode={mode} variant={variant} />
    </div>
  );
}

// Inline loading for buttons
export function ButtonLoadingSpinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
