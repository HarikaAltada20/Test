"use client";

import { Check, ClipboardList, EyeOff, Globe, Lock } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SELECTABLE_ACCESS_MODES, type AccessMode } from "@/lib/campaign-access";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";

type ChecklistRow = { visible: boolean; text: string };

const OPTIONS: {
  value: AccessMode;
  title: string;
  bestFor: string;
  description: string;
  icon: typeof Globe;
  checklist: ChecklistRow[];
}[] = [
  {
    value: "public",
    title: "Public",
    bestFor: "Best for maximum reach",
    description:
      "Everyone sees the full campaign in Opportunities. Who can submit still depends on your requirements.",
    icon: Globe,
    checklist: [
      { visible: true, text: "Title and budget" },
      { visible: true, text: "Full brief" },
      { visible: true, text: "Anyone eligible can submit" },
    ],
  },
  {
    value: "private",
    title: "Private",
    bestFor: "Best for hand-picked creators",
    description:
      "Hidden from everyone except the creators you add. It doesn't appear in discovery.",
    icon: Lock,
    checklist: [
      { visible: false, text: "Hidden from everyone else" },
      { visible: true, text: "Invited creators see it" },
      { visible: true, text: "Full brief for invited creators" },
    ],
  },
  {
    value: "restricted",
    title: "Restricted",
    bestFor: "Best for an open call where you choose",
    description:
      "Everyone sees a preview (title, budget, dates). Creators apply, and the full brief unlocks after you approve them.",
    icon: ClipboardList,
    checklist: [
      { visible: true, text: "Title, budget and dates" },
      { visible: false, text: "Full brief after approval" },
      { visible: true, text: "Apply first, then you approve" },
    ],
  },
];

/** A tiny, decorative sketch of what creators see in each mode. */
function CreatorViewSketch({ mode, ink }: { mode: AccessMode; ink?: boolean }) {
  const bar = "rounded-full bg-gray-200 dark:bg-white/15";
  const label = "text-[9px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500";

  if (mode === "private") {
    return (
      <div aria-hidden="true" className="flex h-[118px] flex-col items-center justify-center gap-2 text-center">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300">
          <Lock className="h-4 w-4" />
        </span>
        <p className="text-[11px] font-medium text-gray-600 dark:text-gray-300">Only invited creators see it</p>
        <p className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
          <EyeOff className="h-3 w-3" /> Invite-only · not in discovery
        </p>
      </div>
    );
  }

  const restricted = mode === "restricted";
  return (
    <div aria-hidden="true" className="h-[118px] space-y-1.5">
      <div className="h-7 rounded-sm bg-gradient-to-r from-gray-200 to-gray-100 dark:from-white/15 dark:to-white/5" />
      <div className={cn(bar, "h-2 w-3/4")} />
      <div className="flex items-center gap-1.5">
        <span className={label}>Budget</span>
        <div className={cn(bar, "h-1.5 w-10 bg-emerald-200 dark:bg-emerald-500/30")} />
      </div>
      <div className="relative">
        <div className={cn("space-y-1", restricted && "select-none blur-[2px]")}>
          <span className={label}>Brief</span>
          <div className={cn(bar, "h-1.5 w-full")} />
          <div className={cn(bar, "h-1.5 w-5/6")} />
        </div>
        {restricted && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/30 to-white/80 dark:from-transparent dark:to-[#170337]/80">
            <span className={cn("flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-medium shadow-sm", ink ? "text-[#1a1a1a] dark:bg-[#1a1a1a] dark:text-white" : "text-[#4A00BE] dark:bg-[#2B1159] dark:text-purple-200")}>
              <Lock className="h-2.5 w-2.5" /> Brief unlocks after approval
            </span>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
            restricted
              ? ink
                ? "bg-[#f3f3f5] text-[#1a1a1a] dark:bg-white/15 dark:text-white"
                : "bg-purple-100 text-[#4A00BE] dark:bg-[#7F39EC]/30 dark:text-purple-200"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
          )}
        >
          {restricted ? "Apply" : "Submit"}
        </span>
      </div>
    </div>
  );
}

type Props = {
  value: AccessMode;
  onChange: (mode: AccessMode) => void;
  disabled?: boolean;
  accent?: "purple" | "ink";
};

export function AccessModeSelector({ value, onChange, disabled, accent = "purple" }: Props) {
  const ink = accent === "ink";
  const isDark = useDashboardDark();
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as AccessMode)}
      aria-label="Who can see this campaign"
      className={cn("grid items-stretch gap-3 md:grid-cols-3", isDark && "dark")}
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
              "flex h-full cursor-pointer flex-col rounded-xl border-2 p-4 transition-colors focus-within:ring-2 focus-within:ring-offset-1 dark:focus-within:ring-offset-transparent",
              ink ? "focus-within:ring-[#1a1a1a]" : "focus-within:ring-[#7F39EC]",
              selected
                ? ink
                  ? "border-[#1a1a1a] bg-[#f6f6f7] dark:border-white dark:bg-white/10"
                  : "border-[#7F39EC] bg-purple-50/60 dark:bg-[#7F39EC]/20"
                : ink
                  ? "border-gray-200 hover:border-[#1a1a1a] dark:border-white/10 dark:hover:border-white/40"
                  : "border-gray-200 hover:border-purple-300 dark:border-white/10 dark:hover:border-[#7F39EC]/60",
              (!selectable || disabled) && "cursor-not-allowed opacity-60",
            )}
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem
                id={id}
                value={opt.value}
                disabled={!selectable || disabled}
                className={cn("mt-1 shrink-0", ink && "border-[#1a1a1a] text-[#1a1a1a]")}
                indicatorClassName={ink ? "text-[#1a1a1a]" : undefined}
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full",
                      selected
                        ? ink
                          ? "bg-[#1a1a1a] text-white"
                          : "bg-[#7F39EC] text-white"
                        : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {opt.title}
                </div>
                <p className={cn("text-xs font-medium", ink ? "text-[#1a1a1a] dark:text-white" : "text-[#7F39EC] dark:text-purple-300")}>{opt.bestFor}</p>
                <p className="text-xs font-normal leading-snug text-gray-500 dark:text-gray-400">
                  {opt.description}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-dashed border-gray-200 bg-white/70 p-2 dark:border-white/15 dark:bg-white/5">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                What creators see
              </p>
              <CreatorViewSketch mode={opt.value} ink={ink} />
            </div>

            <ul className="mt-auto space-y-1 pt-3" aria-label={`${opt.title}: what creators can see`}>
              {opt.checklist.map((row) => (
                <li key={row.text} className="flex items-center gap-1.5 text-xs font-normal text-gray-700 dark:text-gray-300">
                  {row.visible ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" aria-hidden="true" />
                  )}
                  <span>
                    <span className="sr-only">{row.visible ? "Visible: " : "Hidden: "}</span>
                    {row.text}
                  </span>
                </li>
              ))}
            </ul>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
