import { cn } from "@/lib/utils";

/** Neutral theme for the payout dialog. Matches the earnings page, not the old purple UI. */
export function payoutDialogTheme(isDark: boolean) {
  return {
    text: isDark ? "text-white" : "text-[#171717]",
    muted: isDark ? "text-slate-300" : "text-[#44403c]",
    border: isDark ? "border-slate-700" : "border-neutral-200",
    surface: isDark ? "bg-slate-900" : "bg-white",
    subtle: isDark ? "bg-white/5" : "bg-[#F6F6F7]",
    input: cn(
      "h-11 rounded-xl shadow-none focus-visible:ring-[#171717]",
      isDark
        ? "border-slate-600 bg-slate-900 text-white placeholder:text-slate-400"
        : "border-neutral-200 bg-white text-[#171717] placeholder:text-[#737373]",
    ),
    inputError: "border-red-500 focus-visible:ring-red-500",
    error: isDark ? "text-red-400" : "text-red-600",
    success: isDark ? "text-emerald-400" : "text-emerald-700",
    warning: isDark
      ? "border-amber-700/60 bg-amber-950/40 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-950",
    warningIcon: isDark ? "text-amber-400" : "text-amber-600",
    outlineButton: isDark
      ? "rounded-full border-slate-600 bg-transparent text-white hover:bg-white/10"
      : "rounded-full border-neutral-200 bg-white text-[#171717] hover:bg-[#F6F6F7]",
    ghostButton: isDark
      ? "text-slate-200 hover:bg-white/10 hover:text-white"
      : "text-[#171717] hover:bg-[#F4F4F5]",
    primaryButton:
      "h-11 rounded-full bg-[#171717] px-5 text-sm font-medium text-white shadow-none hover:bg-[#2a2a2a] disabled:bg-[#171717] sm:h-10",
    cancelButton: isDark
      ? "h-11 rounded-full px-4 text-sm font-medium text-slate-100 shadow-none hover:bg-white/10 sm:h-10"
      : "h-11 rounded-full px-4 text-sm font-medium text-[#171717] shadow-none hover:bg-[#F4F4F5] sm:h-10",
  };
}

export type PayoutDialogTheme = ReturnType<typeof payoutDialogTheme>;
