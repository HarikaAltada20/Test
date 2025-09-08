import React from 'react';

interface Tab {
  id: string;
  label: string;
}

interface EnhancedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function EnhancedTabs({ tabs, activeTab, onTabChange, className = '' }: EnhancedTabsProps) {
  const getTabClasses = (tab: Tab, index: number) => {
    const isActive = activeTab === tab.id;
    const isFirst = index === 0;
    const isLast = index === tabs.length - 1;
    
    let roundedClasses = '';
    if (isActive) {
      if (isFirst && isLast) {
        roundedClasses = 'rounded-full';
      } else if (isFirst) {
        roundedClasses = 'rounded-l-full';
      } else if (isLast) {
        roundedClasses = 'rounded-r-full';
      }
    }
    
    const baseClasses = `flex-1 px-4 sm:px-6 py-2 sm:py-3.5 font-medium transition-all duration-200 ${roundedClasses}`;
    
    if (isActive) {
      return `${baseClasses} bg-[#662EBD] text-white shadow-sm`;
    } else {
      return `${baseClasses} text-gray-600 hover:text-gray-800 hover:bg-gray-200 hover:rounded-full`;
    }
  };

  return (
    <div className={`bg-[#E4E4E4] rounded-full flex ${className}`}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={getTabClasses(tab, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}