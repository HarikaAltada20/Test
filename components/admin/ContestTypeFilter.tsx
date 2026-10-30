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
  all: "All Campaign Types",
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
            "h-9 rounded-full",
            isDark
              ? "border-white/10 bg-[#161616] text-white hover:bg-white/10"
              : "border-[#e6e6e8] bg-white text-[#1a1a1a] hover:bg-[#e6e6e8]",
          )}
        >
          <span className="truncate">{LABELS[value] ?? "Campaign Type"}</span>
          <ChevronDown className="w-4 h-4 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "min-w-[220px]",
          isDark ? "border-white/10 bg-[#161616] text-white" : "border-[#ececef] bg-white text-[#1a1a1a]",
        )}
      >
        {(
          [
            "all",
            "leaderboard",
            "cpm",
            "milestone",
            "dual_rewards",
          ] as const
        ).map((key) => (
          <DropdownMenuItem
            key={key}
            className={cn(
              "flex items-center gap-2 cursor-pointer font-medium",
              value === key
                ? isDark
                  ? "bg-white/10 text-white focus:bg-white/10 focus:text-white"
                  : "bg-[#e6e6e8] text-[#1a1a1a] focus:bg-[#e6e6e8] focus:text-[#1a1a1a]"
                : isDark
                  ? "text-white focus:bg-white/10 focus:text-white"
                  : "text-[#1a1a1a] focus:bg-[#e6e6e8] focus:text-[#1a1a1a]",
            )}
            onClick={() => onChange(key)}
          >
            <span className="flex h-4 w-4 items-center justify-center text-xs">
              {value === key ? "✓" : ""}
            </span>
            {LABELS[key]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
