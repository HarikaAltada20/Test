"use client";

import { cn } from "@/lib/utils";

const TABS = [
  { id: "analytics", label: "Analytics" },
  { id: "lead", label: "Lead" },
  { id: "sequence", label: "Sequence" },
  { id: "schedule", label: "Schedule" },
  { id: "option", label: "Option" },
] as const;

export type CampaignDetailTab = (typeof TABS)[number]["id"];

type Props = {
  activeTab: CampaignDetailTab;
  onTabChange: (tab: CampaignDetailTab) => void;
};

export function CampaignUnderlineTabs({ activeTab, onTabChange }: Props) {
  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-8 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
              activeTab === tab.id
                ? "border-[#662EBD] text-[#662EBD]"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
