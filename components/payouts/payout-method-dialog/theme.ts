import { cn } from "@/lib/utils";

/** Colour classes for the payout dialog, following the app's isDark palette. */
export function payoutDialogTheme(isDark: boolean) {
  return {
    text: isDark ? "text-white" : "text-gray-900",
    muted: isDark ? "text-gray-400" : "text-gray-600",
    border: isDark ? "border-gray-800" : "border-gray-200",
    surface: isDark ? "bg-[#06021D]" : "bg-white",
    subtle: isDark ? "bg-white/5" : "bg-gray-50",
    input: cn(
      "h-11",
      isDark
        ? "bg-[#06021D] border-gray-600 text-white placeholder:text-gray-500"
        : "bg-white border-gray-300 text-gray-900"
    ),
    inputError: isDark ? "border-red-500 focus-visible:ring-red-500" : "border-red-500 focus-visible:ring-red-500",
    error: isDark ? "text-red-400" : "text-red-600",
    success: isDark ? "text-emerald-400" : "text-emerald-700",
    warning: isDark
      ? "border-amber-700/60 bg-amber-950/40 text-amber-100"
      : "border-amber-300 bg-amber-50 text-amber-900",
    warningIcon: isDark ? "text-amber-400" : "text-amber-600",
    outlineButton: isDark ? "border-gray-600 bg-transparent text-white hover:bg-white/10" : "",
    ghostButton: isDark ? "text-gray-200 hover:bg-white/10 hover:text-white" : "text-gray-700 hover:bg-gray-100",
  };
}

export type PayoutDialogTheme = ReturnType<typeof payoutDialogTheme>;
