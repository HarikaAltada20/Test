"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminPayoutMethodsSummary } from "@/lib/admin-payout-methods";
import type { SkydoStatus } from "@/types/earnings";
import type { SkydoStage } from "./usePayoutMethodsQuery";
import { palette } from "./shared";

const STEPS: {
  status: SkydoStatus;
  label: string;
  hint: string;
  icon: typeof Clock;
}[] = [
  { status: "email_pending", label: "Email pending", hint: "Send Skydo invite", icon: Clock },
  { status: "email_sent", label: "Email sent", hint: "Waiting for user KYC", icon: Send },
  { status: "verified", label: "Verified", hint: "Can withdraw", icon: CheckCircle2 },
];

export function SkydoPipeline({
  summary,
  stage,
  overdue,
  isDark,
  onSelectStage,
  onSelectOverdue,
}: {
  summary: AdminPayoutMethodsSummary | null;
  stage: SkydoStage;
  overdue: boolean;
  isDark: boolean;
  onSelectStage: (stage: SkydoStage) => void;
  onSelectOverdue: () => void;
}) {
  const p = palette(isDark);
  const counts = summary?.by_skydo_status ?? {};
  const totalSkydo = STEPS.reduce((sum, s) => sum + (counts[s.status] ?? 0), 0);
  const overdueCount = summary?.skydo_overdue ?? 0;

  return (
    <div className="space-y-3">
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-[640px] items-stretch gap-2">
          {STEPS.map((step, i) => {
            const count = counts[step.status] ?? 0;
            const active = !overdue && stage === step.status;
            const needsAction = step.status === "email_pending" && count > 0;
            const Icon = step.icon;
            return (
              <div key={step.status} className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSelectStage(step.status)}
                  aria-pressed={active}
                  className={cn(
                    "flex-1 rounded-xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
                    p.surface,
                    p.hover,
                    needsAction &&
                      (isDark
                        ? "border-amber-700/70 bg-amber-950/30"
                        : "border-amber-300 bg-amber-50"),
                    active && "ring-2 ring-[#7F39EC] border-[#7F39EC]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide",
                        p.muted
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                          isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"
                        )}
                      >
                        {i + 1}
                      </span>
                      {step.label}
                    </span>
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        step.status === "email_pending" && "text-amber-500",
                        step.status === "email_sent" && "text-blue-500",
                        step.status === "verified" && "text-emerald-500"
                      )}
                    />
                  </div>
                  <div className="mt-2 text-3xl font-semibold tabular-nums">{count}</div>
                  <div className={cn("mt-0.5 text-xs", p.muted)}>{step.hint}</div>
                </button>
                {i < STEPS.length - 1 && (
                  <ChevronRight className={cn("h-5 w-5 shrink-0", p.muted)} aria-hidden />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={onSelectOverdue}
          disabled={overdueCount === 0 && !overdue}
          aria-pressed={overdue}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-default disabled:opacity-60",
            overdueCount > 0
              ? isDark
                ? "border-red-800 bg-red-950/40 text-red-300 hover:bg-red-950/60"
                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              : isDark
                ? "border-gray-700 text-gray-400"
                : "border-gray-200 text-gray-500",
            overdue && "ring-2 ring-red-500"
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {overdueCount > 0
            ? `${overdueCount} overdue (pending over 24h)`
            : "Nothing overdue"}
        </button>
        <button
          type="button"
          onClick={() => onSelectStage("any")}
          aria-pressed={!overdue && stage === "any"}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            isDark ? "border-gray-700 hover:bg-white/5" : "border-gray-200 hover:bg-gray-50",
            !overdue && stage === "any" && "ring-2 ring-[#7F39EC] border-[#7F39EC]"
          )}
        >
          All Skydo ({totalSkydo})
        </button>
      </div>
    </div>
  );
}
