"use client";

import { ClipboardList, Globe, Lock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SELECTABLE_ACCESS_MODES, type AccessMode } from "@/lib/campaign-access";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";

const OPTIONS: {
  value: AccessMode;
  title: string;
  bestFor: string;
  description: string;
  icon: typeof Globe;
}[] = [
  {
    value: "public",
    title: "Public",
    bestFor: "Best for maximum reach",
    description: "Anyone can see this campaign. Who can submit still depends on the requirements.",
    icon: Globe,
  },
  {
    value: "private",
    title: "Private",
    bestFor: "Best for hand-picked creators",
    description: "Hidden from everyone except creators on this campaign's access list.",
    icon: Lock,
  },
  {
    value: "restricted",
    title: "Restricted",
    bestFor: "Best for an open call where you choose",
    description: "Shows a preview to everyone; creators apply and you approve who joins.",
    icon: ClipboardList,
  },
];

/** A tiny sketch of the campaign card creators see in each mode. */
function CreatorViewSketch({ mode }: { mode: AccessMode }) {
  const bar = "h-1.5 rounded-full bg-gray-200 dark:bg-white/15";
  return (
    <div
      aria-hidden="true"
      className="mt-3 rounded-md border border-dashed border-gray-200 bg-white/70 p-2 dark:border-white/15 dark:bg-white/5"
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        What creators see
      </p>
      {mode === "private" ? (
        <div className="flex items-center gap-2 py-1 text-[11px] text-gray-500 dark:text-gray-400">
          <Lock className="h-3 w-3" /> Only invited creators see it
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className={cn(bar, "h-6 rounded-sm")} />
          <div className={cn(bar, "w-3/4")} />
          <div className="flex items-center justify-between">
            <div className={cn(bar, "w-1/3")} />
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                mode === "restricted"
                  ? "bg-purple-100 text-[#4A00BE] dark:bg-[#7F39EC]/30 dark:text-purple-200"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
              )}
            >
              {mode === "restricted" ? "Apply" : "Submit"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

type Props = {
  value: AccessMode;
  onChange: (mode: AccessMode) => void;
  disabled?: boolean;
};

export function AccessModeSelector({ value, onChange, disabled }: Props) {
  const isDark = useDashboardDark();
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as AccessMode)}
      aria-label="Who can see this campaign"
      className={cn("grid gap-3 md:grid-cols-3", isDark && "dark")}
      disabled={disabled}
    >
      {OPTIONS.map((opt) => {
        const selectable = SELECTABLE_ACCESS_MODES.includes(opt.value);
        const Icon = opt.icon;
        const id = `access-mode-${opt.value}`;
        const selected = value === opt.value;
        return (
          <Label
            key={opt.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-[#7F39EC] focus-within:ring-offset-1 dark:focus-within:ring-offset-transparent",
              selected
                ? "border-[#7F39EC] bg-purple-50/60 dark:bg-[#7F39EC]/20"
                : "border-gray-200 hover:border-purple-300 dark:border-white/10 dark:hover:border-[#7F39EC]/60",
              (!selectable || disabled) && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem
                id={id}
                value={opt.value}
                disabled={!selectable || disabled}
                className="mt-1 shrink-0"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full",
                      selected
                        ? "bg-[#7F39EC] text-white"
                        : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {opt.title}
                </div>
                <p className="text-xs font-medium text-[#7F39EC] dark:text-purple-300">{opt.bestFor}</p>
                <p className="text-xs font-normal leading-snug text-gray-500 dark:text-gray-400">
                  {opt.description}
                </p>
              </div>
            </div>
            <CreatorViewSketch mode={opt.value} />
          </Label>
        );
      })}
    </RadioGroup>
  );
}
