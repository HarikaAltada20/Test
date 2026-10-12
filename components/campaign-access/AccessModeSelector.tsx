"use client";

import { Globe, Lock, ClipboardList } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SELECTABLE_ACCESS_MODES, type AccessMode } from "@/lib/campaign-access";

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
    description: "Visible as a preview; creators apply to join. Coming soon.",
    icon: ClipboardList,
  },
];

type Props = {
  value: AccessMode;
  onChange: (mode: AccessMode) => void;
  disabled?: boolean;
};

export function AccessModeSelector({ value, onChange, disabled }: Props) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as AccessMode)}
      className="grid gap-3 md:grid-cols-3"
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
              "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
              value === opt.value
                ? "border-[#7F39EC] bg-purple-50/60"
                : "border-gray-200 hover:border-purple-300",
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
              <div className="flex items-center gap-2 font-medium text-gray-900">
                <Icon className="h-4 w-4" />
                {opt.title}
              </div>
              <p className="text-xs font-normal leading-snug text-gray-500">
                {opt.description}
              </p>
            </div>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
