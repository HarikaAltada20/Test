import React from "react";

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
      ? "flex-1"
      : "shrink-0 flex-none whitespace-nowrap px-3 sm:px-4";
    const baseClasses = `flex items-center justify-center gap-2 
  ${fillWidth ? "px-4 sm:px-6 py-2 sm:py-3.5" : "py-2 sm:py-2.5"} ${widthClasses} font-medium text-sm sm:text-[0.95rem] transition-all duration-200`;

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
