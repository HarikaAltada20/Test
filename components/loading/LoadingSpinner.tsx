"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import lightLogo from "@/public/images/Group (2).avif";
import darkLogo from "@/public/images/Group (3).avif";
import landingLogo from "@/public/images/page_spinner_logo.png";
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

  return (
    <div className="relative flex items-center justify-center p-2">
      {/* Orange Glow Effect */}
      <div
        className={cn(
          "absolute h-24 w-24 rounded-full blur-2xl transition-all duration-700 animate-pulse",
          isLight ? "bg-orange-500/15" : "bg-orange-500/25"
        )}
      />

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
        className="relative z-10 h-16 w-16 sm:h-20 sm:w-20 drop-shadow-[0_0_15px_rgba(255,106,26,0.6)]"
      >
        <defs>
          <linearGradient
            id="gocOrangeGrad"
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
          rx="2"
          fill={barFill}
          className="goc-bar-left"
        />

        {/* Top Bar */}
        <rect
          x="5.5"
          y="0"
          width="22.5"
          height="5.5"
          rx="2"
          fill={barFill}
          className="goc-bar-top"
        />

        {/* Bottom Bar */}
        <rect
          x="5.5"
          y="23"
          width="22.5"
          height="5.5"
          rx="2"
          fill={barFill}
          className="goc-bar-bottom"
        />

        {/* Right Short Connector Bar */}
        <rect
          x="25"
          y="15.5"
          width="5.5"
          height="7.5"
          rx="2"
          fill={barFill}
          className="goc-bar-right"
        />

        {/* Center Orange Play Arrow */}
        <path
          d="M 10.5 9.5 L 19.5 14.25 L 10.5 19 Z"
          fill="url(#gocOrangeGrad)"
          className="goc-play-arrow"
        />
      </svg>
    </div>
  );
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  mode = "light",
  variant,
  className,
}) => {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">(mode);

  const isDashboard =
    variant === "dashboard"
      ? true
      : variant === "landing"
      ? false
      : Boolean(pathname?.startsWith("/dashboard"));

  const logo = isDashboard
    ? theme === "dark"
      ? darkLogo
      : lightLogo
    : landingLogo;

  // Read mode from data attribute
  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setTheme(currentMode);
        }
      }
    };

    checkMode();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  if (!isDashboard) {
    return (
      <div className={cn("flex items-center justify-center min-h-[140px]", className)}>
        <GocAnimatedLogoSpinner theme={theme} />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className="relative">
        {/* Outermost Rotating Square Border - Clockwise */}
        <div className="w-32 h-32 border-4 border-purple-200/40 rounded-2xl animate-spin"></div>

        {/* Counter-clockwise Border */}
        <div
          className="absolute inset-6 w-20 h-20 border-2 border-purple-600 rounded-xl animate-spin"
          style={{ animationDirection: "reverse" }}
        ></div>

        {/* Center Logo/Icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 flex items-center justify-center">
            <Image
              src={logo}
              alt="Game Of Creators"
              width={80}
              height={80}
              priority
              className={cn(
                "transition-all duration-300 object-contain",
                "h-[50px] w-auto"
              )}
            />
          </div>
        </div>
      </div>
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
