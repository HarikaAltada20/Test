"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequirementCheckItem } from "@/lib/creator-requirements";

type CreatorContestRequirementsGateProps = {
  items: RequirementCheckItem[];
  loading?: boolean;
  fetchFailed?: boolean;
  isDark?: boolean;
  className?: string;
};

export function CreatorContestRequirementsGate({
  items,
  loading = false,
  fetchFailed = false,
  isDark = false,
  className,
}: CreatorContestRequirementsGateProps) {
  if (fetchFailed) {
    return (
      <Alert
        variant="destructive"
        className={cn("mb-4 rounded-xl", className)}
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Unable to verify requirements</AlertTitle>
        <AlertDescription>
          We could not load your eligibility for this campaign. Please refresh
          the page or try again later before submitting.
        </AlertDescription>
      </Alert>
    );
  }

  if (items.length === 0 && !loading) return null;

  const failing = items.filter((item) => !item.passed);

  const shellClass = cn(
    "mb-4 rounded-2xl border shadow-none",
    isDark
      ? "border-white/10 bg-[#161616] text-white"
      : "border-[#e5e5e5] bg-white text-[#1a1a1a]",
  );

  if (loading) {
    return (
      <Alert className={cn(shellClass, className)}>
        <Loader2
          className={cn(
            "h-4 w-4 animate-spin",
            isDark ? "text-white" : "text-[#1a1a1a]",
          )}
        />
        <AlertDescription className={isDark ? "text-slate-300" : "text-[#737373]"}>
          Checking campaign requirements…
        </AlertDescription>
      </Alert>
    );
  }

  if (failing.length === 0) return null;

  return (
    <Alert className={cn(shellClass, className)}>
      <AlertCircle className={cn("h-4 w-4", isDark ? "text-white" : "text-[#1a1a1a]")} />
      <AlertTitle className={cn("font-semibold", isDark ? "text-white" : "text-[#1a1a1a]")}>
        {`You don't meet campaign requirement${failing.length === 1 ? "" : "s"}`}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-3 space-y-3">
          {failing.map((item) => (
            <li key={item.code} className="flex items-start gap-2.5 text-sm">
              <XCircle
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  isDark ? "text-red-400" : "text-[#dc2626]",
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-medium",
                    isDark ? "text-white" : "text-[#1a1a1a]",
                  )}
                >
                  {item.label}
                </p>
                <p
                  className={cn(
                    "text-xs leading-relaxed",
                    isDark ? "text-slate-400" : "text-[#737373]",
                  )}
                >
                  Required: {item.requiredLabel} · Yours: {item.yoursLabel}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
