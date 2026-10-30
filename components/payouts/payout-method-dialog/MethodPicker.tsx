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
  /** Processing fee, e.g. "10% fee". Only set for methods that are switched on. */
  feeLabel?: string;
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
      className="flex flex-col gap-1"
    >
      {options.map((opt) => {
        const meta = getPayoutMethodMeta(opt.type);
        const Icon = meta.icon;
        const selected = value === opt.type;
        const detail = [meta.descriptor, opt.feeLabel, opt.descriptor].filter(Boolean).join(" · ");
        return (
          <RadioGroupPrimitive.Item
            key={opt.type}
            value={opt.type}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2",
              isDark ? "focus-visible:ring-[#ff7a1a]" : "focus-visible:ring-[#171717]",
              "disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? isDark
                  ? "bg-white/10"
                  : "bg-[#E8E8EA]"
                : isDark
                  ? "hover:bg-white/5"
                  : "hover:bg-[#F6F6F7]"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                selected
                  ? isDark
                    ? "bg-white text-[#171717]"
                    : "bg-[#171717] text-white"
                  : isDark
                    ? "bg-white/10 text-white"
                    : "bg-white text-[#171717] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"
              )}
            >
              <Icon aria-hidden className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block text-sm font-semibold", t.text)}>{meta.label}</span>
              <span className={cn("mt-0.5 flex items-start gap-1 text-xs leading-snug", t.muted)}>
                {opt.locked ? <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Clock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span className="whitespace-normal">{detail}</span>
              </span>
              {opt.paused && (
                <span
                  className={cn(
                    "mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    isDark ? "bg-amber-500/15 text-amber-200" : "bg-amber-100 text-amber-900"
                  )}
                >
                  Paused
                </span>
              )}
            </span>
            <span
              aria-hidden
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                selected
                  ? isDark
                    ? "border-[var(--accent-btn-base)] bg-[var(--accent-btn-base)] text-white"
                    : "border-[#171717] bg-[#171717] text-white"
                  : isDark
                    ? "border-white/25"
                    : "border-neutral-300 bg-white"
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
