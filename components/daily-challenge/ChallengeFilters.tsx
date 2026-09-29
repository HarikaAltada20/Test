"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  type Scope,
  type UiLeaderboardPeriod,
} from "./utils";

type Option<T extends string> = { value: T; label: string };

type ChallengeFiltersProps = {
  isDark: boolean;
  leaderboardPeriod: UiLeaderboardPeriod;
  scope: Scope;
  periodOptions: Option<UiLeaderboardPeriod>[];
  scopeOptions: Option<Scope>[];
  onPeriodChange: (value: UiLeaderboardPeriod) => void;
  onScopeChange: (value: Scope) => void;
};

export function ChallengeFilters({
  isDark,
  leaderboardPeriod,
  scope,
  periodOptions,
  scopeOptions,
  onPeriodChange,
  onScopeChange,
}: ChallengeFiltersProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-y px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between",
        isDark ? "border-white/10 bg-white/[0.025]" : "border-slate-200 bg-slate-50/60",
      )}
    >
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Competition window
        </p>
        <div
          className="flex max-w-full items-center gap-1 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Competition window"
        >
          {periodOptions.map((option) => {
            const active = leaderboardPeriod === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onPeriodChange(option.value)}
                className={cn(
                  "shrink-0 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-violet-600 text-white shadow-sm"
                    : isDark
                      ? "text-slate-300 hover:bg-white/5 hover:text-white"
                      : "text-slate-600 hover:bg-white hover:text-slate-950",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-end gap-3 lg:justify-end">
        <div className="w-full space-y-1.5 sm:w-[210px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Submission status
          </p>
          <Select value={scope} onValueChange={(v) => onScopeChange(v as Scope)}>
            <SelectTrigger isDark={isDark} className="h-9 bg-background text-sm">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              {scopeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} isDark={isDark}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
