import React from 'react';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="bg-gray-200 rounded-full p-1 flex">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 px-6 py-3 text-xl font-medium rounded-full${
            activeTab === tab.id
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-gray-600'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}