import React from "react";
import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: React.ReactNode;
  count?: number;
}

interface EnhancedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
  isDark?: boolean;
  light?: boolean;
  /** Compact card-style segmentation for high-level workspace tabs. */
  variant?: "default" | "cards";
  /** When false, tabs use natural width — wrap in overflow-x-auto for long lists */
  fillWidth?: boolean;
}

export function EnhancedTabs({
  tabs,
  activeTab,
  onTabChange,
  className = "",
  isDark = false,
  light = false,
  variant = "default",
  fillWidth = true,
}: EnhancedTabsProps) {
  const getTabClasses = (tab: Tab, index: number) => {
    const isActive = activeTab === tab.id;
    const isFirst = index === 0;
    const isLast = index === tabs.length - 1;

    let activeRoundedClasses = "";
    let hoverRoundedClasses = "hover:rounded-full";

    if (isFirst && isLast) {
      activeRoundedClasses = "rounded-full";
      hoverRoundedClasses = "hover:rounded-full";
    } else if (isFirst) {
      activeRoundedClasses = "rounded-l-full";
      hoverRoundedClasses = "hover:rounded-l-full";
    } else if (isLast) {
      activeRoundedClasses = "rounded-r-full";
      hoverRoundedClasses = "hover:rounded-r-full";
    } else {
      // Middle tabs get full rounding on hover for a smooth pill effect
      hoverRoundedClasses = "hover";
    }

    const widthClasses = fillWidth
      ? "flex-1 min-w-0 whitespace-nowrap"
      : "shrink-0 flex-none whitespace-nowrap px-3 sm:px-4";
    const baseClasses = `flex items-center justify-center gap-1 min-[480px]:gap-2 
  ${fillWidth ? "px-1.5 min-[375px]:px-2.5 min-[480px]:px-4 sm:px-6 py-2 sm:py-3.5" : "py-2 sm:py-2.5"} ${widthClasses} font-medium text-[11px] min-[375px]:text-xs min-[480px]:text-sm sm:text-[0.95rem] transition-all duration-200`;

    if (isActive) {
      return `${baseClasses} ${activeRoundedClasses} bg-[#662EBD] text-white shadow-sm`;
    } else {
      if (isDark) {
        return `${baseClasses} ${hoverRoundedClasses} text-gray-300 hover:text-white hover:bg-[#E4E4E4]/5`;
      } else if (light) {
        return `${baseClasses} ${hoverRoundedClasses} text-gray-600 hover:text-gray-800 hover:bg-gray-200`;
      } else {
        return `${baseClasses} ${hoverRoundedClasses} text-gray-700 hover:text-gray-800 hover:bg-gray-200`;
      }
    }
  };

  const containerBg = isDark
    ? "bg-[#170337]"
    : light
    ? "bg-[#E4E4E4]"
    : "bg-[#E4E4E4]";

  if (variant === "cards") {
    return (
      <div
        className={cn(
          "grid w-full grid-cols-3 gap-1 rounded-xl border p-1.5",
          isDark
            ? "border-white/10 bg-slate-950/45"
            : "border-slate-200/80 bg-slate-100/80",
          className,
        )}
        role="tablist"
        aria-label="User type"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors duration-200 sm:px-3 sm:text-sm",
                isActive
                  ? "bg-[#662EBD] text-white shadow-sm"
                  : isDark
                    ? "text-slate-300 hover:bg-white/10 hover:text-white"
                    : "text-slate-600 hover:bg-white hover:text-slate-950",
              )}
            >
              <span className="truncate">{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums sm:text-[11px]",
                    isActive
                      ? "bg-white/15 text-white"
                      : isDark
                        ? "bg-white/10 text-slate-300"
                        : "bg-slate-200/80 text-slate-600",
                  )}
                >
                  {tab.count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={`${containerBg} rounded-full flex flex-nowrap ${fillWidth ? "w-full" : "w-max max-w-none"} ${className}`}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={getTabClasses(tab, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
