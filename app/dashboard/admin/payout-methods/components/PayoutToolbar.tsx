"use client";

import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SKYDO_STATUSES, SKYDO_STATUS_LABELS } from "@/lib/skydo-payout";
import type { PayoutQueryState } from "./usePayoutMethodsQuery";
import { palette } from "./shared";

const ANY = "any";

export function PayoutToolbar({
  state,
  isDark,
  onChange,
}: {
  state: PayoutQueryState;
  isDark: boolean;
  onChange: (updates: Record<string, string | null>) => void;
}) {
  const p = palette(isDark);
  const [search, setSearch] = useState(state.search);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastPushed = useRef(state.search);

  useEffect(() => {
    if (state.search !== lastPushed.current) {
      lastPushed.current = state.search;
      setSearch(state.search);
    }
  }, [state.search]);

  useEffect(() => {
    const next = search.trim();
    if (next === lastPushed.current.trim()) return;
    const t = setTimeout(() => {
      lastPushed.current = next;
      onChange({ search: next || null });
    }, 350);
    return () => clearTimeout(t);
  }, [search, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      )
        return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const moreCount =
    (state.isDefault ? 1 : 0) + (state.view === "all" && state.skydoStatus ? 1 : 0);

  const selectTriggerClass = cn("h-10 w-full sm:w-[160px]", isDark && "border-gray-700");

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-0 flex-1 sm:min-w-[260px]">
        <Search
          className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", p.muted)}
        />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearch("");
              inputRef.current?.blur();
            }
          }}
          placeholder={
            state.view === "skydo"
              ? "Search name, email or Skydo email"
              : "Search name, email, username, UPI ID, wallet…"
          }
          aria-label="Search payout methods"
          className={cn("h-10 pl-9 pr-16", p.input)}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className={cn("rounded p-1", p.hover)}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd
              className={cn(
                "hidden rounded border px-1.5 text-[10px] font-medium sm:inline",
                isDark ? "border-gray-700 text-gray-400" : "border-gray-200 text-gray-500"
              )}
            >
              /
            </kbd>
          )}
        </div>
      </div>

      <Select
        value={state.userType ?? ANY}
        onValueChange={(v) => onChange({ userType: v === ANY ? null : v })}
      >
        <SelectTrigger isDark={isDark} className={selectTriggerClass} aria-label="User role">
          <SelectValue />
        </SelectTrigger>
        <SelectContent isDark={isDark}>
          <SelectItem isDark={isDark} value={ANY}>All roles</SelectItem>
          <SelectItem isDark={isDark} value="creator">Creators</SelectItem>
          <SelectItem isDark={isDark} value="advertiser">Advertisers</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={state.added}
        onValueChange={(v) =>
          onChange(
            v === "custom"
              ? { added: v }
              : { added: v === ANY ? null : v, createdFrom: null, createdTo: null }
          )
        }
      >
        <SelectTrigger isDark={isDark} className={selectTriggerClass} aria-label="Date added">
          <SelectValue />
        </SelectTrigger>
        <SelectContent isDark={isDark}>
          <SelectItem isDark={isDark} value={ANY}>Added: any time</SelectItem>
          <SelectItem isDark={isDark} value="today">Added today</SelectItem>
          <SelectItem isDark={isDark} value="7d">Last 7 days</SelectItem>
          <SelectItem isDark={isDark} value="30d">Last 30 days</SelectItem>
          <SelectItem isDark={isDark} value="custom">Custom range…</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("h-10 gap-2", p.button)}>
            <SlidersHorizontal className="h-4 w-4" />
            More filters
            {moreCount > 0 && (
              <span className="rounded-full bg-[#7F39EC] px-1.5 text-xs text-white">
                {moreCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className={cn("w-72 space-y-4", isDark && "border-gray-700 bg-[#0B0629] text-white")}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Default method</Label>
            <Select
              value={state.isDefault ?? ANY}
              onValueChange={(v) => onChange({ isDefault: v === ANY ? null : v })}
            >
              <SelectTrigger isDark={isDark}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem isDark={isDark} value={ANY}>Any</SelectItem>
                <SelectItem isDark={isDark} value="true">Default only</SelectItem>
                <SelectItem isDark={isDark} value="false">Not default</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {state.view === "all" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Skydo status</Label>
              <Select
                value={state.skydoStatus ?? ANY}
                onValueChange={(v) => onChange({ skydoStatus: v === ANY ? null : v })}
              >
                <SelectTrigger isDark={isDark}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent isDark={isDark}>
                  <SelectItem isDark={isDark} value={ANY}>Any status</SelectItem>
                  {SKYDO_STATUSES.map((s) => (
                    <SelectItem isDark={isDark} key={s} value={s}>
                      {SKYDO_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {moreCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange({ isDefault: null, skydoStatus: null })}
            >
              Reset these filters
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {state.added === "custom" && (
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Input
            type="date"
            aria-label="Added from"
            value={state.createdFrom ?? ""}
            max={state.createdTo ?? undefined}
            onChange={(e) => onChange({ createdFrom: e.target.value || null })}
            className={cn("h-10 sm:w-[150px]", p.input)}
          />
          <span className={cn("text-sm", p.muted)}>to</span>
          <Input
            type="date"
            aria-label="Added to"
            value={state.createdTo ?? ""}
            min={state.createdFrom ?? undefined}
            onChange={(e) => onChange({ createdTo: e.target.value || null })}
            className={cn("h-10 sm:w-[150px]", p.input)}
          />
        </div>
      )}
    </div>
  );
}
