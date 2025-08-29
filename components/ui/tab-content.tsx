import React from 'react';

interface TabContentProps {
  activeTab: string;
  children: React.ReactNode;
}

export function TabContent({ activeTab, children }: TabContentProps) {
  return (
    <div className="mt-6">
      <div className="animate-fadeIn">
        {children}
      </div>
    </div>
  );
}

interface TabPanelProps {
  value: string;
  activeTab: string;
  children: React.ReactNode;
}

export function TabPanel({ value, activeTab, children }: TabPanelProps) {
  if (value !== activeTab) return null;
  
  return (
    <div className="animate-fadeIn">
      {children}
    </div>
  );
}