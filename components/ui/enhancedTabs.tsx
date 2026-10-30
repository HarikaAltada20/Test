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
  variant?: "default" | "cards" | "underline";
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
  const getTabClasses = (tab: Tab, _index: number) => {
    const isActive = activeTab === tab.id;

    const widthClasses = fillWidth
      ? "flex-1 min-w-0 whitespace-nowrap"
      : "shrink-0 flex-none whitespace-nowrap px-3.5 sm:px-5";
    const baseClasses = `inline-flex items-center justify-center gap-1.5 min-[480px]:gap-2 rounded-full py-2 sm:py-2.5 ${widthClasses} text-xs sm:text-sm font-medium transition-colors leading-none`;

    if (isActive) {
      return `${baseClasses} ${
        isDark
          ? "bg-white/15 text-white shadow-sm font-semibold"
          : "bg-white text-[#1a1a1a] shadow-sm font-semibold"
      }`;
    } else {
      if (isDark) {
        return `${baseClasses} text-white/75 hover:bg-white/10 hover:text-white`;
      } else {
        return `${baseClasses} text-[#3f3f46] hover:bg-white/80 hover:text-[#1a1a1a]`;
      }
    }
  };

  const containerBg = isDark
    ? "bg-white/10"
    : "bg-[#E4E4E4]";

  if (variant === "underline") {
    return (
      <div
        className={cn(
          "flex w-full flex-wrap items-end gap-6 border-b",
          isDark ? "border-white/10" : "border-[#e5e5e5]",
          className,
        )}
        role="tablist"
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
                "relative -mb-px inline-flex items-center gap-2 border-b-2 px-0.5 py-2.5 text-sm transition-colors",
                isActive
                  ? isDark
                    ? "border-white font-semibold text-white"
                    : "border-[#0a0a0a] font-semibold text-[#0a0a0a]"
                  : isDark
                    ? "border-transparent font-medium text-slate-400 hover:text-slate-200"
                    : "border-transparent font-medium text-[#737373] hover:text-[#404040]",
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    isDark
                      ? "bg-white/10 text-slate-200"
                      : "bg-[#e5e5e5] text-[#404040]",
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
        role="group"
        aria-label="User type"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors duration-200 sm:px-3 sm:text-sm",
                isActive
                  ? isDark
                    ? "bg-white/15 text-white shadow-sm"
                    : "bg-white text-[#1a1a1a] shadow-sm"
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
                      ? isDark
                        ? "bg-white/20 text-white"
                        : "bg-[#1a1a1a] text-white"
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
      className={cn(
        "flex max-w-full items-center gap-0.5 sm:gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        containerBg,
        fillWidth ? "w-full" : "w-max max-w-none",
        className,
      )}
      style={{ borderRadius: 9999 }}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={getTabClasses(tab, index)}
          style={{ borderRadius: 9999 }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
