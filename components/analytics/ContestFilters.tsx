"use client";

import { useState } from "react";
import { Users, CheckCircle, Clock, XCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAnalyticsDarkMode } from "@/hooks/use-analytics-dark-mode";
import { cn } from "@/lib/utils";

interface ContestFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  counts: {
    all: number;
    verifiedPaid: number;
    pending: number;
    verified: number;
    rejected: number;
    paid: number;
  };
}

const filterOptions = [
  {
    id: "all",
    label: "All",
    icon: Users,
    count: "all",
  },
  {
    id: "verifiedPaid",
    label: "Verified + Paid",
    icon: CheckCircle,
    count: "verifiedPaid",
  },
  {
    id: "pending",
    label: "Pending",
    icon: Clock,
    count: "pending",
  },
  {
    id: "verified",
    label: "Verified",
    icon: CheckCircle,
    count: "verified",
  },
  {
    id: "rejected",
    label: "Rejected",
    icon: XCircle,
    count: "rejected",
  },
  {
    id: "paid",
    label: "Paid",
    icon: Wallet,
    count: "paid",
  },
];

export default function ContestFilters({
  activeFilter,
  onFilterChange,
  counts,
}: ContestFiltersProps) {
  const { isDark } = useAnalyticsDarkMode();

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {filterOptions.map((filter) => {
        const Icon = filter.icon;
        const count = counts[filter.count as keyof typeof counts];
        const isActive = activeFilter === filter.id;

        return (
          <Button
            key={filter.id}
            variant={isActive ? "default" : "outline"}
            size="sm"
            onClick={() => onFilterChange(filter.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2",
              isActive
                ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-600"
                : isDark
                ? "bg-[#170337] hover:bg-[#2A0B5A] text-white border-gray-600"
                : "bg-white hover:bg-gray-50 text-gray-700 border-gray-200"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="text-sm font-medium">{filter.label}</span>
            <Badge
              variant="secondary"
              className={cn(
                "ml-1",
                isActive
                  ? isDark
                    ? "bg-purple-900/50 text-purple-200"
                    : "bg-purple-100 text-purple-700"
                  : isDark
                  ? "bg-gray-800 text-gray-300"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              {count}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}
