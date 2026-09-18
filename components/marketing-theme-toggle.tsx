"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThemeMode } from "@/hooks/use-theme-mode";

type MarketingThemeToggleProps = {
  className?: string;
  /** When true, use light-chrome styling (dark icons on pale track). */
  lightChrome?: boolean;
};

export function MarketingThemeToggle({
  className,
  lightChrome = false,
}: MarketingThemeToggleProps) {
  const { mode, mounted, setMode } = useThemeMode();
  const isDark = mode === "dark";

  return (
    <div
      role="group"
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center rounded-full p-1 border",
        lightChrome
          ? "border-black/10 bg-black/[0.04]"
          : "border-white/15 bg-white/[0.06]",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Switch to light mode"
        aria-pressed={mounted ? !isDark : false}
        onClick={() => setMode("light")}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
          mounted && !isDark
            ? lightChrome
              ? "bg-white text-[#6d28d9] shadow-sm"
              : "bg-white text-[#6d28d9] shadow-[0_4px_14px_rgba(0,0,0,0.18)]"
            : lightChrome
              ? "text-black/45 hover:text-black/70"
              : "text-white/45 hover:text-white/75",
        )}
      >
        <Sun className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <button
        type="button"
        aria-label="Switch to dark mode"
        aria-pressed={mounted ? isDark : true}
        onClick={() => setMode("dark")}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200",
          mounted && isDark
            ? "bg-[#7c3aed] text-white shadow-[0_4px_14px_rgba(124,58,237,0.45)]"
            : lightChrome
              ? "text-black/45 hover:text-black/70"
              : "text-white/45 hover:text-white/75",
        )}
      >
        <Moon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
