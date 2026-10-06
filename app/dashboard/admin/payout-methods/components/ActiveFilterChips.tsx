"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SKYDO_STATUS_LABELS } from "@/lib/skydo-payout";
import type { PayoutQueryState } from "./usePayoutMethodsQuery";
import { METHOD_LABELS } from "./shared";

const ADDED_LABELS: Record<string, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

export function ActiveFilterChips({
  state,
  isDark,
  onChange,
  onClearAll,
}: {
  state: PayoutQueryState;
  isDark: boolean;
  onChange: (updates: Record<string, string | null>) => void;
  onClearAll: () => void;
}) {
  const chips: { key: string; label: string; clear: Record<string, string | null> }[] = [];

  if (state.search.trim())
    chips.push({ key: "search", label: `Search: "${state.search.trim()}"`, clear: { search: null } });
  if (state.view === "all" && state.methodType)
    chips.push({
      key: "method",
      label: `Method: ${METHOD_LABELS[state.methodType] ?? state.methodType}`,
      clear: { methodType: null },
    });
  if (state.view === "all" && state.skydoStatus)
    chips.push({
      key: "skydoStatus",
      label: `Skydo: ${SKYDO_STATUS_LABELS[state.skydoStatus]}`,
      clear: { skydoStatus: null },
    });
  if (state.userType)
    chips.push({
      key: "role",
      label: `Role: ${state.userType === "creator" ? "Creators" : state.userType === "advertiser" ? "Advertisers" : state.userType}`,
      clear: { userType: null },
    });
  if (state.isDefault)
    chips.push({
      key: "default",
      label: state.isDefault === "true" ? "Default only" : "Not default",
      clear: { isDefault: null },
    });
  if (state.added !== "any") {
    const label =
      state.added === "custom"
        ? `Added: ${state.createdFrom ?? "…"} to ${state.createdTo ?? "…"}`
        : `Added: ${ADDED_LABELS[state.added]}`;
    chips.push({
      key: "added",
      label,
      clear: { added: null, createdFrom: null, createdTo: null },
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span
          key={c.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border py-0.5 pl-3 pr-1 text-xs",
            isDark ? "border-[#7F39EC]/60 bg-[#7F39EC]/15" : "border-[#D9C0FF] bg-[#F5EEFF] text-[#4A00BE]"
          )}
        >
          {c.label}
          <button
            type="button"
            onClick={() => onChange(c.clear)}
            aria-label={`Remove filter ${c.label}`}
            className="rounded-full p-0.5 hover:bg-black/10"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className={cn(
          "text-xs font-medium underline-offset-2 hover:underline",
          isDark ? "text-gray-300" : "text-gray-600"
        )}
      >
        Clear all
      </button>
    </div>
  );
}
