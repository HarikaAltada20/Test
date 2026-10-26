"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type Scope } from "./utils";

type Option<T extends string> = { value: T; label: string };

type ScopeControlProps = {
  isDark: boolean;
  scope: Scope;
  scopeOptions: Option<Scope>[];
  onScopeChange: (value: Scope) => void;
  className?: string;
};

export function ScopeControl({
  isDark,
  scope,
  scopeOptions,
  onScopeChange,
  className,
}: ScopeControlProps) {
  return (
    <Select
      value={scope}
      onValueChange={(value) => onScopeChange(value as Scope)}
    >
      <SelectTrigger
        isDark={isDark}
        aria-label="Counting"
        className={cn(
          "h-auto w-[156px] min-w-[156px] justify-start gap-2 rounded-xl px-3 py-2 text-left shadow-sm [&>span]:line-clamp-none [&>span]:whitespace-normal [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-[#292524] [&>svg]:opacity-100",
          isDark
            ? "border-white/10 bg-[#1c1422] text-white"
            : "border-[#e7e5e4] bg-white text-[#171717]",
          className,
        )}
      >
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span
            className={cn(
              "text-xs font-semibold",
              isDark ? "text-neutral-200" : "text-[#292524]",
            )}
          >
            Counting
          </span>
          <span
            className={cn(
              "text-base font-semibold",
              isDark ? "text-white" : "text-[#171717]",
            )}
          >
            <SelectValue />
          </span>
        </span>
      </SelectTrigger>
      <SelectContent isDark={isDark} className="min-w-[160px]">
        {scopeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value} isDark={isDark}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
