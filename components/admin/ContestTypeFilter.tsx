"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ContestTypeFilterProps {
    value?: "all" | "leaderboard" | "cpm";
    onChange?: (value: string) => void;
}

export default function ContestTypeFilter({ value = "all", onChange: customOnChange }: ContestTypeFilterProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mode, setMode] = useState<"light" | "dark">("light");
  // Read mode from data attribute
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

    // Watch for changes in the data attribute
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
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className={cn(
                "border w-44",
                isDark ? "border-gray-600" : "border-gray-400"
            )}>
                <SelectValue placeholder="Contest Type" />
            </SelectTrigger>
            <SelectContent isDark={isDark} >
                <SelectItem value="all" isDark={isDark}>All Contest Types</SelectItem>
                <SelectItem value="leaderboard" isDark={isDark}>Leaderboard</SelectItem>
                <SelectItem value="cpm" isDark={isDark}>CPM</SelectItem>
            </SelectContent>
        </Select>
    );
}


