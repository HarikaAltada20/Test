"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RequirementCheckItem } from "@/lib/creator-requirements";

type CreatorContestRequirementsGateProps = {
  items: RequirementCheckItem[];
  loading?: boolean;
  isDark?: boolean;
  className?: string;
};

export function CreatorContestRequirementsGate({
  items,
  loading = false,
  isDark = false,
  className,
}: CreatorContestRequirementsGateProps) {
  if (items.length === 0 && !loading) return null;

  const failing = items.filter((item) => !item.passed);
  const hasFailures = failing.length > 0;

  if (loading) {
    return (
      <Alert
        className={cn(
          "mb-4 rounded-xl border border-[#7F39EC] bg-[#D9C0FF26]",
          className,
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin text-[#4A00BE]" />
        <AlertDescription
          className={cn(isDark ? "text-gray-200" : "text-[#4A00BE]")}
        >
          Checking campaign requirements…
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert
      className={cn(
        "mb-4 rounded-xl shadow-sm",
        hasFailures
          ? "border border-[#7F39EC] bg-[#D9C0FF26]"
          : "border border-emerald-500/40 bg-emerald-500/10",
        className,
      )}
    >
      {hasFailures ? (
        <AlertCircle className="h-4 w-4 text-[#4A00BE]" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      )}
      <AlertTitle
        className={cn(
          hasFailures
            ? isDark
              ? "text-[#D9C0FF]"
              : "text-[#4A00BE]"
            : "text-emerald-800 dark:text-emerald-100",
        )}
      >
        {hasFailures
          ? `You don't meet campaign requirement${items.length === 1 ? "" : "s"}`
          : "You meet all campaign requirements"}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li key={item.code} className="flex items-start gap-2.5 text-sm">
              {item.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#7F39EC]" />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-medium",
                    item.passed
                      ? isDark
                        ? "text-slate-200"
                        : "text-slate-800"
                      : isDark
                        ? "text-[#D9C0FF]"
                        : "text-[#4A00BE]",
                  )}
                >
                  {item.label}
                </p>
                <p
                  className={cn(
                    "text-xs leading-relaxed",
                    item.passed
                      ? isDark
                        ? "text-gray-300"
                        : "text-muted-foreground"
                      : isDark
                        ? "text-gray-300"
                        : "text-[#4A00BE]/80",
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
