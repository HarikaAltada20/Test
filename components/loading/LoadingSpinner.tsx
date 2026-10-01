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
                isDashboard
                  ? "h-[50px] w-auto"
                  : "h-[38px] w-[38px] drop-shadow-[0_0_10px_rgba(255,106,26,0.6)]"
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
