import { cn } from "@/lib/utils";

/** Neutral theme for the payout dialog. Matches the earnings page, not the old purple UI. */
export function payoutDialogTheme(
  isDark: boolean,
  options?: { brand?: boolean },
) {
  void options;
  const accentRing = "focus-visible:ring-[var(--accent-btn-base)]";
  return {
    text: isDark ? "text-white" : "text-[#171717]",
    muted: isDark ? "text-white/55" : "text-[#44403c]",
    border: isDark ? "border-white/10" : "border-neutral-200",
    surface: isDark ? "bg-[#161616]" : "bg-white",
    subtle: isDark ? "bg-[#0e0e0e]" : "bg-[#F6F6F7]",
    input: cn(
      "h-11 rounded-xl shadow-none",
      isDark
        ? cn(
            "border-white/10 bg-[#0e0e0e] text-white placeholder:text-white/40",
            accentRing,
          )
        : cn(
            "border-neutral-200 bg-white text-[#171717] placeholder:text-[#737373]",
            accentRing,
          ),
    ),
    inputError: "border-red-500 focus-visible:ring-red-500",
    error: isDark ? "text-red-400" : "text-red-600",
    success: isDark ? "text-emerald-400" : "text-emerald-700",
    warning: isDark
      ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
      : "border-amber-200 bg-amber-50 text-amber-950",
    warningIcon: isDark ? "text-amber-400" : "text-amber-600",
    outlineButton: isDark
      ? "rounded-full border-white/20 bg-transparent text-white hover:bg-white/10"
      : "rounded-full border-neutral-200 bg-white text-[#171717] hover:bg-[#F6F6F7]",
    ghostButton: isDark
      ? "text-white/80 hover:bg-white/10 hover:text-white"
      : "text-[#171717] hover:bg-[#F4F4F5]",
    primaryButton:
      "h-11 rounded-full goc-btn-primary px-5 text-sm font-medium sm:h-10",
    cancelButton: isDark
      ? "h-11 rounded-full px-4 text-sm font-medium text-white shadow-none hover:bg-white/10 sm:h-10"
      : "h-11 rounded-full px-4 text-sm font-medium text-[#171717] shadow-none hover:bg-[#F4F4F5] sm:h-10",
  };
}

export type PayoutDialogTheme = ReturnType<typeof payoutDialogTheme>;
