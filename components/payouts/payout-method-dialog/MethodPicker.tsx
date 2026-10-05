"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Check, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayoutMethodType } from "@/types/earnings";
import { getPayoutMethodMeta } from "./methodMeta";
import { payoutDialogTheme } from "./theme";

export interface MethodPickerOption {
  type: PayoutMethodType;
  /** Status shown under the processing time, e.g. "Unlocks at $5.00". */
  descriptor?: string;
  locked?: boolean;
  paused?: boolean;
}

export function MethodPicker({
  options,
  value,
  onChange,
  isDark,
  disabled,
  labelledBy,
}: {
  options: MethodPickerOption[];
  value: PayoutMethodType;
  onChange: (type: PayoutMethodType) => void;
  isDark: boolean;
  disabled?: boolean;
  labelledBy: string;
}) {
  const t = payoutDialogTheme(isDark);

  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(v) => onChange(v as PayoutMethodType)}
      disabled={disabled}
      aria-labelledby={labelledBy}
      className={cn(
        "grid gap-2",
        options.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-4"
      )}
    >
      {options.map((opt) => {
        const meta = getPayoutMethodMeta(opt.type);
        const Icon = meta.icon;
        const selected = value === opt.type;
        return (
          <RadioGroupPrimitive.Item
            key={opt.type}
            value={opt.type}
            className={cn(
              "group relative flex min-h-[72px] flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] focus-visible:ring-offset-2",
              isDark ? "focus-visible:ring-offset-[#06021D]" : "focus-visible:ring-offset-white",
              "disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? isDark
                  ? "border-[#9B6BF2] bg-[#7F39EC]/15"
                  : "border-[#7F39EC] bg-[#7F39EC]/5"
                : isDark
                  ? "border-gray-700 hover:border-gray-500 hover:bg-white/5"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <span className="flex w-full items-center gap-2">
              <Icon
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0",
                  selected ? (isDark ? "text-[#C9A7FF]" : "text-[#7F39EC]") : t.muted
                )}
              />
              <span className={cn("text-sm font-semibold", t.text)}>{meta.label}</span>
              <span
                aria-hidden
                className={cn(
                  "ml-auto flex h-4 w-4 items-center justify-center rounded-full transition-opacity",
                  selected ? "bg-[#7F39EC] text-white opacity-100" : "opacity-0"
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            </span>
            <span className={cn("flex items-center gap-1 text-xs", t.muted)}>
              <Clock aria-hidden className="h-3 w-3 shrink-0" />
              {meta.descriptor}
            </span>
            {opt.descriptor && (
              <span className={cn("flex items-center gap-1 text-xs font-medium", t.text)}>
                {opt.locked && <Lock aria-hidden className="h-3 w-3 shrink-0" />}
                {opt.descriptor}
              </span>
            )}
            {opt.paused && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                  isDark ? "bg-amber-950/60 text-amber-200" : "bg-amber-100 text-amber-900"
                )}
              >
                Paused for withdrawals
              </span>
            )}
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
