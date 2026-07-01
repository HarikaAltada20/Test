"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2, XCircle } from "lucide-react";
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

  if (failing.length === 0) return null;

  return (
    <Alert
      className={cn(
        "mb-4 rounded-xl shadow-sm border border-[#7F39EC] bg-[#D9C0FF26]",
        className,
      )}
    >
      <AlertCircle className="h-4 w-4 text-[#4A00BE]" />
      <AlertTitle
        className={cn(isDark ? "text-[#D9C0FF]" : "text-[#4A00BE]")}
      >
        {`You don't meet campaign requirement${failing.length === 1 ? "" : "s"}`}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-3 space-y-3">
          {failing.map((item) => (
            <li key={item.code} className="flex items-start gap-2.5 text-sm">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#7F39EC]" />
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-medium",
                    isDark ? "text-[#D9C0FF]" : "text-[#4A00BE]",
                  )}
                >
                  {item.label}
                </p>
                <p
                  className={cn(
                    "text-xs leading-relaxed",
                    isDark ? "text-gray-300" : "text-[#4A00BE]/80",
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
