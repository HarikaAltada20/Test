"use client"
import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface TabConfig {
  defaultTab?: string;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'default' | 'pills' | 'underline';
}

export const useTabState = (tabs: TabItem[], config?: TabConfig) => {
  const [activeTab, setActiveTab] = React.useState(
    config?.defaultTab || tabs[0]?.id || ''
  );

  const handleTabChange = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab && !tab.disabled) {
      setActiveTab(tabId);
    }
  };

  return {
    activeTab,
    setActiveTab: handleTabChange,
  };
};