"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const LABELS: Record<string, string> = {
  all: "All Contest Types",
  leaderboard: "Leaderboard",
  cpm: "CPM",
  milestone: "Milestone",
  dual_rewards: "Dual Rewards",
};

interface ContestTypeFilterProps {
  value?: "all" | "leaderboard" | "cpm" | "milestone" | "dual_rewards";
  onChange?: (value: string) => void;
}

export default function ContestTypeFilter({
  value = "all",
  onChange: customOnChange,
}: ContestTypeFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    const checkMode = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode") as
          | "light"
          | "dark";
        if (currentMode) {
          setMode(currentMode);
        }
      }
    };

    checkMode();

    const observer = new MutationObserver(checkMode);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, []);

  const isDark = mode === "dark";

  const onChange = (next: string) => {
    if (customOnChange) {
      customOnChange(next);
    } else {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (next === "all") {
        params.delete("type");
      } else {
        params.set("type", next);
      }
      const qs = params.toString();
      const href = qs ? `/dashboard/admin?${qs}` : "/dashboard/admin";
      router.push(href);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "flex items-center gap-2 min-w-[160px] w-44 justify-between",
            isDark
              ? "bg-[#170337] text-white border-gray-600"
              : "bg-white hover:bg-gray-50 text-gray-700 border-gray-400",
          )}
        >
          <span className="truncate">{LABELS[value] ?? "Contest Type"}</span>
          <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "min-w-[220px]",
          isDark ? "bg-[#06021D] border-gray-800" : "bg-white",
        )}
      >
        <DropdownMenuItem
          className={cn(
            "flex items-center gap-2 cursor-pointer font-medium",
            isDark ? "text-white focus:bg-white/10" : "text-gray-900",
          )}
          onClick={() => onChange("all")}
        >
          {value === "all" && (
            <span className="w-4 h-4 flex items-center justify-center text-xs">
              ✓
            </span>
          )}
          {value !== "all" && <span className="w-4" />}
          All Contest Types
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            "flex items-center gap-2 cursor-pointer font-medium",
            isDark ? "text-white focus:bg-white/10" : "text-gray-900",
          )}
          onClick={() => onChange("leaderboard")}
        >
          {value === "leaderboard" && (
            <span className="w-4 h-4 flex items-center justify-center text-xs">
              ✓
            </span>
          )}
          {value !== "leaderboard" && <span className="w-4" />}
          Leaderboard
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            "flex items-center gap-2 cursor-pointer font-medium",
            isDark ? "text-white focus:bg-white/10" : "text-gray-900",
          )}
          onClick={() => onChange("cpm")}
        >
          {value === "cpm" && (
            <span className="w-4 h-4 flex items-center justify-center text-xs">
              ✓
            </span>
          )}
          {value !== "cpm" && <span className="w-4" />}
          CPM
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            "flex items-center gap-2 cursor-pointer font-medium",
            isDark ? "text-white focus:bg-white/10" : "text-gray-900",
          )}
          onClick={() => onChange("milestone")}
        >
          {value === "milestone" && (
            <span className="w-4 h-4 flex items-center justify-center text-xs">
              ✓
            </span>
          )}
          {value !== "milestone" && <span className="w-4" />}
          Milestone
        </DropdownMenuItem>
        <DropdownMenuItem
          className={cn(
            "flex items-center gap-2 cursor-pointer font-medium",
            isDark ? "text-white focus:bg-white/10" : "text-gray-900",
          )}
          onClick={() => onChange("dual_rewards")}
        >
          {value === "dual_rewards" && (
            <span className="w-4 h-4 flex items-center justify-center text-xs">
              ✓
            </span>
          )}
          {value !== "dual_rewards" && <span className="w-4" />}
          Dual Rewards
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
