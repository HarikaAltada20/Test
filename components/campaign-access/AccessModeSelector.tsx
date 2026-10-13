"use client";

import { Globe, Lock, ClipboardList } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SELECTABLE_ACCESS_MODES, type AccessMode } from "@/lib/campaign-access";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";

const OPTIONS: {
  value: AccessMode;
  title: string;
  description: string;
  icon: typeof Globe;
}[] = [
  {
    value: "public",
    title: "Public",
    description: "Anyone can see this campaign. Who can submit still depends on the requirements.",
    icon: Globe,
  },
  {
    value: "private",
    title: "Private",
    description: "Hidden from everyone except creators on this campaign's access list.",
    icon: Lock,
  },
  {
    value: "restricted",
    title: "Restricted",
    description: "Shows a preview to everyone; creators apply and you approve who joins.",
    icon: ClipboardList,
  },
];

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
        return (
          <Label
            key={opt.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors focus-within:ring-2 focus-within:ring-[#7F39EC] focus-within:ring-offset-1 dark:focus-within:ring-offset-transparent",
              value === opt.value
                ? "border-[#7F39EC] bg-purple-50/60 dark:bg-[#7F39EC]/20"
                : "border-gray-200 hover:border-purple-300 dark:border-white/10 dark:hover:border-[#7F39EC]/60",
              (!selectable || disabled) && "cursor-not-allowed opacity-60",
            )}
          >
            <RadioGroupItem
              id={id}
              value={opt.value}
              disabled={!selectable || disabled}
              className="mt-0.5 shrink-0"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {opt.title}
              </div>
              <p className="text-xs font-normal leading-snug text-gray-500 dark:text-gray-400">
                {opt.description}
              </p>
            </div>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
